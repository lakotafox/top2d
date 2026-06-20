# Adventure Crafter — C# / MonoGame port

Native port of `thesoup.html` (the World Builder editor + runtime) to **C# + MonoGame**, so it can
ship to desktop / console / mobile from one codebase.

This lives on the **`monogame-port`** branch and is a **side-branch attempt** — it never modifies
the original `assets/`, `sounds/`, `src/`, `thesoup.html`, or any original save. All derived content
(e.g. MP3→OGG audio) is generated from **copies** under `content-derived/`.

See the master plan: `~/.claude/plans/dynamic-giggling-koala.md`.

## Layout

```
port/
  AdventureCrafter.sln
  src/
    AdventureCrafter.Core/      net8, no MonoGame — the save-format contract + pure logic
    AdventureCrafter.Runtime/   MonoGame DesktopGL — the playable game (refs Core)
    AdventureCrafter.Editor/    MonoGame DesktopGL — the world builder (refs Core + Runtime)
  tests/
    AdventureCrafter.Core.Tests/  round-trip + determinism tests
  fixtures/                     small exported save files for testing (NOT the mega-save)
```

## Build

Requires **.NET 8 SDK** and the MonoGame templates:

```
brew install dotnet@8
dotnet new install MonoGame.Templates.CSharp
dotnet build port/AdventureCrafter.sln
dotnet test  port/tests/AdventureCrafter.Core.Tests
```

## Status

M0 — toolchain + scaffold + `ProjectData` contract. See plan for the milestone roadmap.
