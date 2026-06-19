        // ===== PLAYER SPRITE =====
        function loadPlayerSprite(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                playerSpriteData = e.target.result;
                playerSpriteImg = new Image();
                playerSpriteImg.onload = () => {
                    // Update preview
                    const preview = document.getElementById('playerSpritePreview');
                    const ctx = preview.getContext('2d');
                    ctx.clearRect(0, 0, 48, 48);
                    ctx.imageSmoothingEnabled = false;
                    // Draw first frame (assuming 64x64 frames, top-left)
                    ctx.drawImage(playerSpriteImg, 0, 0, 64, 64, 0, 0, 48, 48);
                    document.getElementById('playerSpriteInfo').textContent =
                        file.name + ' (' + playerSpriteImg.naturalWidth + 'x' + playerSpriteImg.naturalHeight + ')';
                };
                playerSpriteImg.src = playerSpriteData;
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }

        function updatePlayerSpritePreview() {
            const preview = document.getElementById('playerSpritePreview');
            if (!preview) return;
            const ctx = preview.getContext('2d');
            ctx.clearRect(0, 0, 48, 48);

            if (playerSpriteImg && playerSpriteImg.complete && playerSpriteImg.naturalWidth > 0) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(playerSpriteImg, 0, 0, 64, 64, 0, 0, 48, 48);
            }
        }
