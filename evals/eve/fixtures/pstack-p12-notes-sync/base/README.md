# jot

Plain-text notes kept as Markdown files in `~/.jot/notes/`, synced through a
shared folder (Dropbox/iCloud/Syncthing) at `~/.jot/remote/`.

```sh
python -m jot new "groceries"
python -m jot edit groceries        # opens $EDITOR
python -m jot list
python -m jot sync                  # copies changes both ways
python -m unittest
```

Most people run `jot sync` from cron or a launchd agent every 10 minutes; the
companion phone app runs the same sync logic in the background. Some people
also run it by hand before closing their laptop.
