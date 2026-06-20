#!/usr/bin/env bash
# Launch the MonoGame port runtime. Usage:
#   ./run.sh                       # plays the committed tiny fixture (house_inside)
#   ./run.sh /path/to/save.json    # plays any exported Adventure Crafter save
#
# Controls: Arrow keys or WASD to move, Esc to quit.
set -e
export DOTNET_ROOT=/opt/homebrew/opt/dotnet@8/libexec
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export PATH="/opt/homebrew/opt/dotnet@8/bin:$PATH"
HERE="$(cd "$(dirname "$0")" && pwd)"
exec dotnet run --project "$HERE/src/AdventureCrafter.Runtime/AdventureCrafter.Runtime.csproj" -c Debug -- "$@"
