        // ===== USABLE ITEMS / ABILITIES (sword swing + boomerang) =====
        let projectiles = [];

        // Item currently held in the active hotbar slot (the "equipped" item).
        function getActiveItemDef() {
            const slot = inventorySlots[selectedHotbarSlot];
            if (!slot || slot.itemIndex == null) return null;
            return { def: itemsData[slot.itemIndex], index: slot.itemIndex } ;
        }

        // The attack button now uses whatever is equipped.
        function useActiveItem() {
            const a = getActiveItemDef();
            if (!a || !a.def || !a.def.behavior || a.def.behavior === 'none') return; // nothing usable -> can't attack
            if (a.def.behavior === 'sword') {
                player.attackDamage = a.def.abilityDamage || 10;
                startSwordAttack();
            } else if (a.def.behavior === 'boomerang') {
                throwBoomerang(a.def, a.index);
            } else if (a.def.behavior === 'fishingPole') {
                if (player.fishing) player.fishing = null; // reel in / cancel
                else startFishing();
            }
        }

        // ===== FISHING =====
        // Use a Fishing Pole while facing the edge of a fish zone -> cast -> wait for a
        // bite -> weighted loot handed over via the existing receive-item animation.
        function fishZoneInFront() {
            const md = mapsData[currentGameMap];
            const zones = (md && md.fishZones) || [];
            if (!zones.length) return false;
            const tileSize = gridSize * TILE_SCALE;
            const ptx = Math.floor((player.x + player.width / 2) / tileSize);
            const pty = Math.floor((player.y + player.height * 0.8) / tileSize);
            const v = dirToVec(cardinalOf(player.direction));
            const ftx = ptx + Math.round(v.x);
            const fty = pty + Math.round(v.y);
            const inZone = (tx, ty) => zones.some(z => tx >= z.x && tx < z.x + z.width && ty >= z.y && ty < z.y + z.height);
            return inZone(ftx, fty) && !inZone(ptx, pty); // facing INTO water, standing on land
        }

        function startFishing() {
            if (player.fishing) return;
            if (player.attacking || isReceivingItem || inventoryOpen || activeDialog || shopOpen) return;
            if (!fishZoneInFront()) { console.log('[FISHING] Not facing a fish zone edge'); return; }
            player.moving = false;
            player.fishing = {
                phase: 'cast',
                dir: cardinalOf(player.direction),
                frame: 0,
                frameTimer: 0,
                waitTimer: 0,
                biteDelay: 120 + Math.floor(Math.random() * 240) // 2-6s at ~60fps
            };
            console.log('[FISHING] Cast!');
        }

        function updateFishing() {
            if (!player.fishing) return;
            const f = player.fishing;
            // Any movement input reels in / cancels the cast.
            if (keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight']) {
                player.fishing = null;
                return;
            }
            const suf = f.dir.charAt(0).toUpperCase() + f.dir.slice(1);
            if (f.phase === 'cast') {
                const castFrames = (playerAnimations['fishCast' + suf] || []).length || 1;
                const fps = playerAnimFpsList['fishCast' + suf] || 8;
                if (++f.frameTimer >= 60 / fps) { f.frameTimer = 0; f.frame++; }
                if (f.frame >= castFrames) { f.phase = 'wait'; f.frame = 0; f.frameTimer = 0; f.waitTimer = 0; }
            } else if (f.phase === 'wait') {
                const waitFrames = (playerAnimations['fishWait' + suf] || []).length || 1;
                const fps = playerAnimFpsList['fishWait' + suf] || 6;
                if (++f.frameTimer >= 60 / fps) { f.frameTimer = 0; f.frame = (f.frame + 1) % waitFrames; }
                if (++f.waitTimer >= f.biteDelay) catchFish();
            }
        }

        function catchFish() {
            player.fishing = null;
            const loot = (typeof fishingLoot !== 'undefined' && fishingLoot) || [];
            let pick = null;
            if (loot.length) {
                const total = loot.reduce((s, e) => s + (e.weight || 1), 0);
                let r = Math.random() * total;
                for (const e of loot) { r -= (e.weight || 1); if (r <= 0) { pick = e; break; } }
                if (!pick) pick = loot[loot.length - 1];
            }
            if (pick && pick.itemIndex != null && itemsData[pick.itemIndex]) {
                console.log('[FISHING] Caught:', itemsData[pick.itemIndex].name);
                startReceivingItem(pick.itemIndex, itemsData[pick.itemIndex]);
            } else {
                console.log('[FISHING] Bite! ...but no loot table is set — nothing caught.');
            }
        }

        function startSwordAttack() {
            if (player.attacking) return;
            player.attacking = true;
            player.attackAnim = true;
            player.attackFrame = 0;
            player.attackFrameTimer = 0;
            player.attackTimer = 30;
            player.attackHitNpcs = {};
            player.throwing = false;
            if (playerSoundsData.attack && playerSoundsData.attack.soundIndex >= 0) {
                playSound(playerSoundsData.attack.soundIndex, playerSoundsData.attack.volume || 0.7, playerSoundsData.attack.pitchVariation || 0.15, playerSoundsData.attack.lengthVariation || 0);
            }
        }

        function dirVector() {
            // True unit vector incl. diagonals so projectiles fire along the actual facing.
            return dirToVec(player.direction);
        }

        // Resolve the player animation to play for an ability use. Prefers a directional anim
        // (e.g. "throwDown") then a single one (e.g. "throw"); returns null to fall back to attack.
        function resolveAbilityAnimKey(name) {
            if (!name || !playerAnimations) return null;
            const suffix = { down: 'Down', up: 'Up', left: 'Left', right: 'Right' }[cardinalOf(player.direction)] || 'Down';
            if (playerAnimations[name + suffix] && playerAnimations[name + suffix].length) return name + suffix;
            if (playerAnimations[name] && playerAnimations[name].length) return name;
            return null;
        }

        function throwBoomerang(def, itemIndex) {
            // Only one of the player's boomerangs in flight at a time.
            if (projectiles.some(p => p.type === 'boomerang')) return;
            const d = dirVector();
            const px = player.x + player.width / 2;
            const py = player.y + player.height / 2;
            projectiles.push({
                type: 'boomerang', x: px, y: py, dirX: d.x, dirY: d.y,
                speed: def.abilitySpeed || 7, maxRange: (def.abilityRange || 180) * TILE_SCALE,
                dist: 0, phase: 'out', dmg: def.abilityDamage || 10, itemIndex: itemIndex,
                hit: {}, frame: 0, frameTimer: 0
            });
            // The boomerang has NO player throw pose by default — the player keeps idle/walking while it
            // flies and spins on its own (this matches the original game). Only if the creator explicitly
            // sets a "Player anim on use" do we play it (reusing the attack lifecycle, melee suppressed).
            const key = resolveAbilityAnimKey(def.abilityAnim);
            if (key) {
                player.throwAnimKey = key;
                startSwordAttack();
                player.throwing = true;
            }
        }

        // Shared enemy-hit used by projectiles — mirrors the center/damage math in checkAttackHitbox.
        function hitEnemiesAt(wx, wy, radius, dmg, hitSet) {
            const tileSize = gridSize * TILE_SCALE;
            for (let i = 0; i < placedNpcs.length; i++) {
                const placed = placedNpcs[i]; const state = npcRuntimeState[i];
                if (!placed || !placed.isEnemy || !state || state.dead) continue;
                if (hitSet && hitSet[i]) continue;
                const npc = npcs[placed.npcIndex]; if (!npc) continue;
                const npcScale = placed.scale || 1;
                const scaledW = tileSize * npcScale, scaledH = tileSize * npcScale;
                const cx = state.x * TILE_SCALE + tileSize / 2;
                const cy = state.y * TILE_SCALE + tileSize - scaledH / 2;
                const dx = wx - cx, dy = wy - cy;
                const r = radius + Math.max(scaledW, scaledH) * 0.4;
                if (dx * dx + dy * dy <= r * r) {
                    damageNPC(i, dmg);
                    if (hitSet) hitSet[i] = true;
                }
            }
        }

        function updateProjectiles() {
            const pcx = player.x + player.width / 2;
            const pcy = player.y + player.height / 2;
            for (let i = projectiles.length - 1; i >= 0; i--) {
                const p = projectiles[i];
                if (p.type === 'boomerang') {
                    if (p.phase === 'out') {
                        p.x += p.dirX * p.speed; p.y += p.dirY * p.speed; p.dist += p.speed;
                        if (p.dist >= p.maxRange) { p.phase = 'return'; p.hit = {}; }
                    } else {
                        const dx = pcx - p.x, dy = pcy - p.y;
                        const len = Math.hypot(dx, dy) || 1;
                        p.x += (dx / len) * p.speed; p.y += (dy / len) * p.speed;
                        if (len < 26) { projectiles.splice(i, 1); continue; } // caught
                    }
                    hitEnemiesAt(p.x, p.y, 12, p.dmg, p.hit);
                    p.frameTimer++;
                    if (p.frameTimer >= 3) { p.frameTimer = 0; p.frame++; }
                }
            }
        }

        function drawProjectiles(camX, camY) {
            const tileSize = gridSize * TILE_SCALE;
            for (const p of projectiles) {
                if (p.type !== 'boomerang') continue;
                const img = itemImages[p.itemIndex];
                const def = itemsData[p.itemIndex];
                const sx = Math.floor(p.x - camX), sy = Math.floor(p.y - camY);
                if (img && img.complete && def && def.frames && def.frames.length) {
                    const f = def.frames[p.frame % def.frames.length];
                    const dw = tileSize * 0.7;
                    const dh = dw * (f.h / f.w);
                    ctx.save();
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(img, f.x, f.y, f.w, f.h, sx - dw / 2, sy - dh / 2, dw, dh);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#ffcf33';
                    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, 7); ctx.fill();
                }
            }
        }
