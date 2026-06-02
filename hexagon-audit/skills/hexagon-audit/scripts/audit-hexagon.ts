#!/usr/bin/env bun

import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

type PackageKind = 'package' | 'adapter'

type WorkspacePackage = {
  dependencies: DependencyEdge[]
  dir: string
  kind: PackageKind
  name: string
  packageJson: string
}

type DependencyEdge = {
  line: number
  name: string
  section: string
}

type Finding = {
  file: string
  line: number
  message: string
  specifier: string
}

const root = process.cwd()
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'])
const skippedDirs = new Set(['.git', 'dist', 'node_modules', 'coverage'])

const vendorChecks = [
  {
    label: '@modelcontextprotocol/sdk',
    matches: (specifier: string) => specifier.startsWith('@modelcontextprotocol/sdk'),
  },
  {
    label: '@anthropic-ai/sdk',
    matches: (specifier: string) => specifier.startsWith('@anthropic-ai/sdk'),
  },
  {
    label: '@google-cloud/*',
    matches: (specifier: string) => specifier.startsWith('@google-cloud/'),
  },
  {
    label: 'bun:sqlite',
    matches: (specifier: string) => specifier === 'bun:sqlite',
  },
  {
    label: 'postgres',
    matches: (specifier: string) => specifier === 'postgres' || specifier.startsWith('postgres/'),
  },
  {
    label: 'pg',
    matches: (specifier: string) => specifier === 'pg' || specifier.startsWith('pg/'),
  },
  {
    label: 'kubernetes-client',
    matches: (specifier: string) => specifier === 'kubernetes-client' || specifier.startsWith('kubernetes-client/'),
  },
] as const

async function workspacePackages(baseDir: string, kind: PackageKind): Promise<WorkspacePackage[]> {
  const base = path.join(root, baseDir)
  const entries = await readdir(base, { withFileTypes: true }).catch(() => [])
  const packages: WorkspacePackage[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const dir = path.join(base, entry.name)
    const packageJson = path.join(dir, 'package.json')
    const raw = await readFile(packageJson, 'utf8').catch(() => undefined)
    if (!raw) {
      continue
    }

    const parsed = JSON.parse(raw) as Record<string, unknown> & { name?: unknown }
    if (typeof parsed.name !== 'string') {
      continue
    }

    packages.push({
      dependencies: dependencyEdges(raw, parsed),
      dir,
      kind,
      name: parsed.name,
      packageJson,
    })
  }

  return packages
}

function dependencyEdges(raw: string, parsed: Record<string, unknown>): DependencyEdge[] {
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
  const edges: DependencyEdge[] = []

  for (const section of sections) {
    const dependencies = parsed[section]
    if (!isDependencyMap(dependencies)) {
      continue
    }

    for (const name of Object.keys(dependencies)) {
      const index = raw.indexOf(`"${name}"`)
      edges.push({ line: index >= 0 ? lineFor(raw, index) : 1, name, section })
    }
  }

  return edges
}

function isDependencyMap(value: unknown): value is Record<string, string> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files: string[] = []

  for (const entry of entries) {
    if (skippedDirs.has(entry.name)) {
      continue
    }

    const next = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(next)))
      continue
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(next)
    }
  }

  return files
}

function relative(file: string): string {
  return path.relative(root, file).split(path.sep).join('/')
}

function lineFor(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

// Single-pass scanner: emit module specifiers from import/export/require, while
// ignoring anything inside comments or unrelated string/template literals. This
// keeps commented-out or example imports (and "import ... from ..." text that
// merely lives inside a string) from registering as real dependencies.
function importSpecifiers(text: string): Array<{ specifier: string; index: number }> {
  const specifiers: Array<{ specifier: string; index: number }> = []
  const isWord = (ch: string) => /[A-Za-z0-9_$]/.test(ch)
  let i = 0
  let wordBuf = ''
  // prevToken: last word or single punctuation char in code (whitespace skipped).
  let prevToken = ''
  // parenOwner: the token immediately before the most recent '('.
  let parenOwner = ''

  const flushWord = () => {
    if (wordBuf) {
      prevToken = wordBuf
      wordBuf = ''
    }
  }

  while (i < text.length) {
    const c = text[i]
    const n = text[i + 1]

    // comments
    if (c === '/' && n === '/') {
      flushWord()
      i += 2
      while (i < text.length && text[i] !== '\n') i++
      prevToken = ''
      continue
    }
    if (c === '/' && n === '*') {
      flushWord()
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
      i += 2
      prevToken = ''
      continue
    }

    // string / template literals
    if (c === "'" || c === '"' || c === '`') {
      flushWord()
      const isSpecifier =
        prevToken === 'from' ||
        prevToken === 'import' ||
        (prevToken === '(' && (parenOwner === 'import' || parenOwner === 'require'))
      const quote = c
      const contentStart = i + 1
      let j = contentStart
      while (j < text.length) {
        if (text[j] === '\\') {
          j += 2
          continue
        }
        if (text[j] === quote) break
        j++
      }
      if (isSpecifier && j <= text.length) {
        const specifier = text.slice(contentStart, j)
        if (specifier) specifiers.push({ specifier, index: contentStart })
      }
      i = j + 1
      prevToken = 'string'
      continue
    }

    // identifiers / keywords
    if (isWord(c)) {
      wordBuf += c
      i++
      continue
    }

    // any other character: it's a punctuation token
    flushWord()
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '(') {
      parenOwner = prevToken
      prevToken = '('
      i++
      continue
    }
    prevToken = c
    i++
  }

  return specifiers
}

function packageForFile(file: string, packages: WorkspacePackage[]): WorkspacePackage | undefined {
  const candidates = packages.filter((pkg) => file === pkg.dir || file.startsWith(`${pkg.dir}${path.sep}`))
  return candidates.sort((a, b) => b.dir.length - a.dir.length)[0]
}

async function resolveSpecifier(fromFile: string, specifier: string): Promise<string | undefined> {
  if (!specifier.startsWith('.')) {
    return undefined
  }

  const absolute = path.resolve(path.dirname(fromFile), specifier)
  const candidates = [
    absolute,
    `${absolute}.ts`,
    `${absolute}.tsx`,
    `${absolute}.js`,
    `${absolute}.jsx`,
    `${absolute}.mjs`,
    `${absolute}.cjs`,
    `${absolute}.mts`,
    `${absolute}.cts`,
    path.join(absolute, 'index.ts'),
    path.join(absolute, 'index.tsx'),
    path.join(absolute, 'index.js'),
    path.join(absolute, 'index.jsx'),
    path.join(absolute, 'index.mjs'),
    path.join(absolute, 'index.cjs'),
  ]

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate
    }
  }

  return absolute
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

function printFindings(title: string, findings: Finding[]): void {
  console.log(`\n${title}: ${findings.length}`)
  for (const finding of findings) {
    console.log(`  ${finding.file}:${finding.line} ${finding.message} (${finding.specifier})`)
  }
}

const packageWorkspaces = await workspacePackages('packages', 'package')
const adapterWorkspaces = await workspacePackages('adapters', 'adapter')
const allWorkspaces = [...packageWorkspaces, ...adapterWorkspaces]
const adapterNames = new Set(adapterWorkspaces.map((pkg) => pkg.name))

// Resolve an import specifier to its adapter package name, matching both the
// bare name (`@acme/foo-adapter`) and exported subpaths (`@acme/foo-adapter/client`).
function adapterNameForSpecifier(specifier: string): string | undefined {
  if (adapterNames.has(specifier)) {
    return specifier
  }
  const segments = specifier.split('/')
  const base = specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]
  return adapterNames.has(base) ? base : undefined
}
const files = [...(await walk(path.join(root, 'packages'))), ...(await walk(path.join(root, 'adapters')))]

const packageToAdapter: Finding[] = []
const adapterToPeerAdapter: Finding[] = []
const vendorInPackages: Finding[] = []

for (const workspace of allWorkspaces) {
  for (const dependency of workspace.dependencies) {
    if (workspace.kind === 'package') {
      if (adapterNames.has(dependency.name)) {
        packageToAdapter.push({
          file: relative(workspace.packageJson),
          line: dependency.line,
          message: `package ${dependency.section} depends on adapter package`,
          specifier: dependency.name,
        })
      }

      for (const vendor of vendorChecks) {
        if (vendor.matches(dependency.name)) {
          vendorInPackages.push({
            file: relative(workspace.packageJson),
            line: dependency.line,
            message: `package ${dependency.section} declares vendor SDK ${vendor.label}`,
            specifier: dependency.name,
          })
        }
      }
    }

    if (workspace.kind === 'adapter' && adapterNames.has(dependency.name) && dependency.name !== workspace.name) {
      adapterToPeerAdapter.push({
        file: relative(workspace.packageJson),
        line: dependency.line,
        message: `adapter ${dependency.section} depends on peer adapter package`,
        specifier: dependency.name,
      })
    }
  }
}

for (const file of files) {
  const owner = packageForFile(file, allWorkspaces)
  if (!owner) {
    continue
  }

  const text = await readFile(file, 'utf8')
  for (const imported of importSpecifiers(text)) {
    const line = lineFor(text, imported.index)

    if (owner.kind === 'package') {
      if (adapterNameForSpecifier(imported.specifier)) {
        packageToAdapter.push({
          file: relative(file),
          line,
          message: 'package imports adapter package',
          specifier: imported.specifier,
        })
      }

      const resolved = await resolveSpecifier(file, imported.specifier)
      if (resolved && relative(resolved).startsWith('adapters/')) {
        packageToAdapter.push({
          file: relative(file),
          line,
          message: 'package imports adapter path',
          specifier: imported.specifier,
        })
      }

      for (const vendor of vendorChecks) {
        if (vendor.matches(imported.specifier)) {
          vendorInPackages.push({
            file: relative(file),
            line,
            message: `package imports vendor SDK ${vendor.label}`,
            specifier: imported.specifier,
          })
        }
      }
    }

    if (owner.kind === 'adapter') {
      const peerAdapter = adapterNameForSpecifier(imported.specifier)
      if (peerAdapter && peerAdapter !== owner.name) {
        adapterToPeerAdapter.push({
          file: relative(file),
          line,
          message: 'adapter imports peer adapter package',
          specifier: imported.specifier,
        })
      }

      const resolved = await resolveSpecifier(file, imported.specifier)
      const resolvedOwner = resolved ? packageForFile(resolved, adapterWorkspaces) : undefined
      if (resolvedOwner && resolvedOwner.name !== owner.name) {
        adapterToPeerAdapter.push({
          file: relative(file),
          line,
          message: 'adapter imports peer adapter path',
          specifier: imported.specifier,
        })
      }
    }
  }
}

console.log('Hexagon audit baseline')
console.log(`packages discovered: ${packageWorkspaces.length}`)
console.log(`adapters discovered: ${adapterWorkspaces.length}`)

printFindings('packages importing adapters', packageToAdapter)
printFindings('adapters importing peer adapters', adapterToPeerAdapter)
printFindings('vendor SDK imports inside packages', vendorInPackages)

if (packageToAdapter.length > 0 || adapterToPeerAdapter.length > 0) {
  process.exitCode = 1
}
