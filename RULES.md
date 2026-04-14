# Reglas del Sistema de Publicación Automática

## Cuenta y Horario

1. **Cuenta de Instagram**: @welove_luana (ID: `17841400374479883`)
2. **Horario de publicación**: 8:00 AM y 7:00 PM hora Colombia (UTC-5), todos los días
3. **Ejecución**: GitHub Actions con cron automático
   - 8:00 AM COT = `0 13 * * *` UTC
   - 7:00 PM COT = `0 0 * * *` UTC (día siguiente en UTC)

## Contenido y Frecuencia (Batch por turno)

4. **Turno MAÑANA (8:00 AM)**: 9 publicaciones (~5 productos + ~4 videos)
5. **Turno NOCHE (7:00 PM)**: 7 publicaciones (~4 productos + ~3 videos)
6. **Mezcla**: Aproximadamente 50% productos y 50% videos, en orden aleatorio
7. **Delay entre publicaciones**: 5 segundos
8. **Total diario**: 16 publicaciones (9 + 7)

## Videos / Reels como Stories

9. **Fuente de videos**: Carpeta de Google Drive (folder ID: `1bFMfh7_UOjuw8sWiLMhUyh6z7ruCHsYd`)
10. **Configuración**: `data/reels-config.json` contiene los file IDs de Google Drive
    - `mandatory[]`: IDs de videos obligatorios (1 se publica siempre en la mañana)
    - `pool[]`: IDs del pool general de videos
11. **Publicación**: Se usa la URL directa de Google Drive como `video_url` para Instagram
    - Formato: `https://drive.google.com/uc?export=download&id={FILE_ID}&confirm=t`
12. **Video obligatorio**: En el turno de mañana, siempre se incluye 1 video del array `mandatory`
13. **Publisher**: `publishVideoStory()` en `src/instagram/publisher.js`

## Productos (Stories con imagen)

14. **Fuente**: Colección `best-sellers` de weloveluana.com (Shopify JSON pública)
15. **Cantidad total**: ~82 productos disponibles (fetch con `limit=250`)
16. **Selección**: Aleatoria de todos los productos no publicados
17. **Reset de historial**: Cuando se acaban los productos sin publicar, se limpia el historial y se empieza de nuevo
18. **Variantes de color**: Si un producto tiene la opción "Color", se elige una variante de color al azar y se usa una imagen correspondiente a ese color
19. **Detección facial**: Se prefieren imágenes con modelo (detección con ONNX Runtime + Ultra-Light Face Detector)
20. **URLs**: Siempre con UTMs: `?utm_source=instagram&utm_medium=organico&utm_campaign=post&utm_content=story`

## Diseño Visual de Stories de Producto

21. **Dimensiones**: 1080x1920 px, JPEG calidad 92%
22. **Layout**:
    - Imagen del producto: 90% superior
    - Zona de texto: 10% inferior (con degradé blanco del 20%)
23. **Colores**: Fondo blanco (#FFFFFF), degradé siempre blanco, texto siempre negro (#000000)
24. **Tipografía**: Montserrat (Bold y Regular)
25. **Elementos visuales**:
    - Título del producto en mayúsculas (36px bold)
    - Precio original tachado arriba del precio final (si hay descuento)
    - Badge circular de descuento al lado derecho del precio final
    - Botón "COMPRAR AHORA" (fondo negro, texto blanco)
    - Texto "weloveluana.com" en la parte inferior
26. **No escribir URLs completas sobre la imagen** (solo "weloveluana.com")

## Infraestructura Técnica

27. **Hosting de imágenes**: GitHub raw content (`raw.githubusercontent.com`) vía GitHub API
    - Se sube a `/media/`, se publica, se elimina tras publicar
28. **API de Instagram**: Graph API v19.0
    - `POST /{ig-user-id}/media` con `media_type=STORIES` + `image_url` (fotos)
    - `POST /{ig-user-id}/media` con `media_type=STORIES` + `video_url` (videos)
    - Polling del container hasta `FINISHED`
    - `POST /{ig-user-id}/media_publish` con `creation_id`
29. **API de Shopify**: JSON pública (`/collections/{handle}/products.json`) sin autenticación
30. **Historial**: Archivo `data/posted-history.json` commiteado al repo
31. **Estrategia de commit del historial**: `cp` + `reset --hard origin/main` + `cp` back (para evitar conflictos)
32. **Permisos necesarios del token de Instagram**:
    - `instagram_basic`
    - `instagram_content_publish`
    - `pages_show_list`

## Mantenimiento

33. **Token de Instagram**: expira cada 60 días, requiere renovación manual
34. **Commit del historial**: con `[skip ci]` para evitar loops
35. **Timeout del workflow**: 30 minutos (batch con 9 publicaciones + delays)
