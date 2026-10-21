import { expect, test } from "bun:test";
import { toCsv } from "../src/csv";

test("quotes cells containing commas and quotes", () => {
  expect(toCsv(["a", "b"], [["x,y", 'say "hi"']])).toBe('a,b\n"x,y","say ""hi"""\n');
});

test("leaves plain cells alone", () => {
  expect(toCsv(["n"], [[1], [2]])).toBe("n\n1\n2\n");
});
