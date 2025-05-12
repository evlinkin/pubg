class MapViewer {
    constructor() {
        this.mapContainer = document.getElementById('map-container');
        this.cursor = document.getElementById('cursor');
        this.distanceElement = document.getElementById('distance');
        this.scaleElement = document.getElementById('scale');
        this.resetPinsButton = document.getElementById('resetPins');
        this.resetScaleButton = document.getElementById('resetScale');
        this.mapButtons = document.querySelectorAll('.map-button');

        this.markers = [];
        this.currentMap = 'miramar';
        this.isDragging = false;
        this.lastMousePosition = { x: 0, y: 0 };
        this.scale = 1;

        this.initThree();
        this.initializeEventListeners();
        this.loadMap();
    }

    initThree() {
        // Создаем сцену
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2a2a2a);

        // Создаем ортографическую камеру
        const aspect = this.mapContainer.clientWidth / this.mapContainer.clientHeight;
        this.camera = new THREE.OrthographicCamera(
            -400 * aspect, 400 * aspect,
            400, -400,
            0.1, 1000
        );
        this.camera.position.z = 100;

        // Создаем рендерер
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.mapContainer.clientWidth, this.mapContainer.clientHeight);
        this.mapContainer.appendChild(this.renderer.domElement);

        // Создаем группу для карты и маркеров
        this.mapGroup = new THREE.Group();
        this.scene.add(this.mapGroup);

        // Добавляем обработчик изменения размера окна
        window.addEventListener('resize', () => {
            const aspect = this.mapContainer.clientWidth / this.mapContainer.clientHeight;
            this.camera.left = -400 * aspect;
            this.camera.right = 400 * aspect;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.mapContainer.clientWidth, this.mapContainer.clientHeight);
        });

        // Запускаем анимационный цикл
        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }

    loadMap() {
        // Загружаем текстуру карты
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(`${this.currentMap}.png`, (texture) => {
            if (this.mapMesh) {
                this.mapGroup.remove(this.mapMesh);
            }

            const geometry = new THREE.PlaneGeometry(800, 800);
            const material = new THREE.MeshBasicMaterial({ 
                map: texture,
                transparent: true
            });
            this.mapMesh = new THREE.Mesh(geometry, material);
            this.mapGroup.add(this.mapMesh);

            // Добавляем сетку после загрузки карты
            this.drawGrid();
        });
    }

    drawGrid() {
        // Удаляем старую сетку если она есть
        if (this.gridLines) {
            this.gridLines.forEach(line => this.mapGroup.remove(line));
        }
        this.gridLines = [];

        const material = new THREE.LineBasicMaterial({ 
            color: 0x000000,
            transparent: true,
            opacity: 0.3
        });

        // Создаем линии сетки (8x8)
        for (let i = 0; i <= 8; i++) {
            // Вертикальные линии
            const verticalGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(i * 100 - 400, -400, 1),
                new THREE.Vector3(i * 100 - 400, 400, 1)
            ]);
            const verticalLine = new THREE.Line(verticalGeometry, material);
            this.mapGroup.add(verticalLine);
            this.gridLines.push(verticalLine);

            // Горизонтальные линии
            const horizontalGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-400, i * 100 - 400, 1),
                new THREE.Vector3(400, i * 100 - 400, 1)
            ]);
            const horizontalLine = new THREE.Line(horizontalGeometry, material);
            this.mapGroup.add(horizontalLine);
            this.gridLines.push(horizontalLine);
        }
    }

    initializeEventListeners() {
        // Обработчики кнопок переключения карт
        this.mapButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.mapButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.currentMap = button.dataset.map;
                this.loadMap();
                this.resetPins();
            });
        });

        // Кнопка сброса маркеров
        this.resetPinsButton.addEventListener('click', () => this.resetPins());

        // Кнопка сброса масштаба
        this.resetScaleButton.addEventListener('click', () => {
            this.camera.zoom = 1;
            this.camera.updateProjectionMatrix();
            this.mapGroup.position.set(0, 0, 0);
            this.scale = 1;
            this.scaleElement.textContent = '100';
        });

        // Обработка перетаскивания
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Только левая кнопка мыши
                this.isDragging = true;
                this.lastMousePosition = {
                    x: e.clientX,
                    y: e.clientY
                };
                this.mapContainer.classList.add('grabbing');
            }
        });

        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = e.clientX - this.lastMousePosition.x;
                const deltaY = e.clientY - this.lastMousePosition.y;

                this.mapGroup.position.x += deltaX / this.camera.zoom;
                this.mapGroup.position.y -= deltaY / this.camera.zoom;

                this.lastMousePosition = {
                    x: e.clientX,
                    y: e.clientY
                };
            }
        });

        this.renderer.domElement.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.mapContainer.classList.remove('grabbing');
        });

        this.renderer.domElement.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.mapContainer.classList.remove('grabbing');
        });

        // Обработка колесика мыши для зума
        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();

            const zoomSpeed = 0.1;
            const delta = e.deltaY > 0 ? -1 : 1;
            const newZoom = this.camera.zoom * (1 + delta * zoomSpeed);

            // Ограничиваем зум (не меньше 100%)
            if (newZoom >= 1 && newZoom <= 4) {
                // Получаем позицию мыши относительно центра карты
                const rect = this.renderer.domElement.getBoundingClientRect();
                const mouseX = ((e.clientX - rect.left) / this.renderer.domElement.clientWidth) * 2 - 1;
                const mouseY = -((e.clientY - rect.top) / this.renderer.domElement.clientHeight) * 2 + 1;

                // Сохраняем старый зум
                const oldZoom = this.camera.zoom;

                // Устанавливаем новый зум
                this.camera.zoom = newZoom;
                this.camera.updateProjectionMatrix();

                // Корректируем позицию карты для зума в точку под курсором
                const zoomRatio = newZoom / oldZoom;
                const worldMouseX = mouseX * (400 * this.mapContainer.clientWidth / this.mapContainer.clientHeight) / oldZoom;
                const worldMouseY = mouseY * 400 / oldZoom;

                this.mapGroup.position.x -= worldMouseX * (zoomRatio - 1);
                this.mapGroup.position.y -= worldMouseY * (zoomRatio - 1);

                this.scale = newZoom;
                this.scaleElement.textContent = Math.round(newZoom * 100);
            }
        });

        // Обработка клика для установки маркеров
        this.renderer.domElement.addEventListener('click', (e) => {
            if (!this.isDragging) {
                const rect = this.renderer.domElement.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / this.renderer.domElement.clientWidth) * 2 - 1;
                const y = -((e.clientY - rect.top) / this.renderer.domElement.clientHeight) * 2 + 1;

                // Преобразуем координаты экрана в координаты мира
                const worldX = (x * 400 * this.mapContainer.clientWidth / this.mapContainer.clientHeight) / this.camera.zoom - this.mapGroup.position.x;
                const worldY = (y * 400) / this.camera.zoom - this.mapGroup.position.y;

                this.placeMarker(worldX, worldY);
            }
        });

        // Показываем/скрываем курсор
        this.renderer.domElement.addEventListener('mouseenter', () => {
            this.cursor.style.display = 'block';
        });

        this.renderer.domElement.addEventListener('mouseleave', () => {
            this.cursor.style.display = 'none';
        });
    }

    placeMarker(x, y) {
        if (this.markers.length === 2) {
            this.resetPins();
        }

        // Создаем геометрию маркера
        const geometry = new THREE.CircleGeometry(5, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            side: THREE.DoubleSide
        });
        const marker = new THREE.Mesh(geometry, material);
        
        // Добавляем белую обводку
        const outlineGeometry = new THREE.CircleGeometry(6, 32);
        const outlineMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            side: THREE.DoubleSide
        });
        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        
        // Группируем маркер и обводку
        const markerGroup = new THREE.Group();
        markerGroup.add(outline);
        markerGroup.add(marker);
        markerGroup.position.set(x, y, 2);

        this.markers.push(markerGroup);
        this.mapGroup.add(markerGroup);

        if (this.markers.length === 2) {
            this.drawMeasurementLine();
            this.calculateDistance();
        }
    }

    drawMeasurementLine() {
        if (this.measurementLine) {
            this.mapGroup.remove(this.measurementLine);
        }

        const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
        const points = [
            new THREE.Vector3(
                this.markers[0].position.x,
                this.markers[0].position.y,
                2
            ),
            new THREE.Vector3(
                this.markers[1].position.x,
                this.markers[1].position.y,
                2
            )
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.measurementLine = new THREE.Line(geometry, material);
        this.mapGroup.add(this.measurementLine);
    }

    calculateDistance() {
        const dx = this.markers[1].position.x - this.markers[0].position.x;
        const dy = this.markers[1].position.y - this.markers[0].position.y;
        const pixelDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Конвертируем в метры (8000 метров = 800 пикселей)
        const metersPerPixel = 8000 / 800;
        const distanceInMeters = Math.round(pixelDistance * metersPerPixel);
        
        this.distanceElement.textContent = distanceInMeters;
    }

    resetPins() {
        this.markers.forEach(marker => this.mapGroup.remove(marker));
        this.markers = [];
        
        if (this.measurementLine) {
            this.mapGroup.remove(this.measurementLine);
            this.measurementLine = null;
        }
        
        this.distanceElement.textContent = '0';
    }
}

// Initialize the map viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MapViewer();
}); 