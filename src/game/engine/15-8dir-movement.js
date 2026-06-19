        // ===== 8-DIRECTION MOVEMENT SUPPORT (TEST-GAME copy) =====
        // The Test Game is a SEPARATE document/window from the builder, so it needs its own
        // copy of these helpers (the builder has an identical copy near its top).
        function dirSuffix(dir) { return dir.charAt(0).toUpperCase() + dir.slice(1); }
        function dir8FromVector(dx, dy, allowDiagonal) {
            if (!dx && !dy) return null;
            const ax = Math.abs(dx), ay = Math.abs(dy);
            if (allowDiagonal && ax > 0.0001 && ay > 0.0001 && ax > ay * 0.41 && ay > ax * 0.41) {
                return (dy < 0 ? 'up' : 'down') + (dx < 0 ? 'Left' : 'Right');
            }
            if (ax > ay) return dx < 0 ? 'left' : 'right';
            return dy < 0 ? 'up' : 'down';
        }
        function cardinalOf(dir) {
            switch (dir) {
                case 'upLeft': case 'upRight': return 'up';
                case 'downLeft': case 'downRight': return 'down';
                default: return dir;
            }
        }
        function dirToVec(dir) {
            const d = 0.7071;
            switch (dir) {
                case 'left':  return { x: -1, y: 0 };
                case 'right': return { x: 1,  y: 0 };
                case 'up':    return { x: 0,  y: -1 };
                case 'down':  return { x: 0,  y: 1 };
                case 'upLeft':    return { x: -d, y: -d };
                case 'upRight':   return { x: d,  y: -d };
                case 'downLeft':  return { x: -d, y: d };
                case 'downRight': return { x: d,  y: d };
                default: return { x: 0, y: 1 };
            }
        }
        function hasDiagonalAnims(anims) {
            return !!(anims && ((anims.walkUpLeft && anims.walkUpLeft.length) ||
                (anims.walkUpRight && anims.walkUpRight.length) ||
                (anims.walkDownLeft && anims.walkDownLeft.length) ||
                (anims.walkDownRight && anims.walkDownRight.length)));
        }
        function resolveWalkKey(anims, dir) {
            const has = k => !!(anims && anims[k] && anims[k].length > 0);
            const own = 'walk' + dirSuffix(dir);
            if (has(own)) return { key: own, flip: false };
            const mirrorFrom = { left: 'right', upLeft: 'upRight', downLeft: 'downRight' };
            if (mirrorFrom[dir]) {
                const src = 'walk' + dirSuffix(mirrorFrom[dir]);
                if (has(src)) return { key: src, flip: true };
            }
            const card = cardinalOf(dir);
            if (card !== dir) {
                if (has('walk' + dirSuffix(card))) return { key: 'walk' + dirSuffix(card), flip: false };
                if (card === 'left' && has('walkRight')) return { key: 'walkRight', flip: true };
            }
            return { key: own, flip: false };
        }
        // ===== END 8-DIRECTION MOVEMENT SUPPORT (TEST-GAME copy) =====
