# Docs Site

The repository now includes a simple MkDocs setup so the markdown in `docs/` can also be served as a small documentation site.

## Why MkDocs Here

- the project already has several technical docs
- navigation matters once the repo has frontend, backend, C++, and math notes
- MkDocs keeps the documentation lightweight and versionable

Python is only used for this documentation layer, not for the pendulum simulation itself.

## Files

- [mkdocs.yml](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/mkdocs.yml)
- [requirements-docs.txt](/c:/Users/SMARTECHLATAM%20GERALD/Desktop/git3/normal-modes-of-coupled-pendulums/requirements-docs.txt)

## Install

```powershell
python -m pip install -r requirements-docs.txt
```

## Serve Locally

```powershell
python -m mkdocs serve
```

By default, MkDocs serves the site at `http://127.0.0.1:8000/`.

## Build Static Site

```powershell
python -m mkdocs build
```

The generated site will be written to `site/`.
