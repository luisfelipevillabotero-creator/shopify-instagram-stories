# Reglas del Sistema de Publicación Automática

## Cuenta y Horario

1. **Cuenta de Instagram**: @welove_luana (ID: `17841400374479883`)
2. **Horario de publicación**: 8:00 AM y 7:00 PM hora Colombia (UTC-5), todos los días
3. **Ejecución**: GitHub Actions con cron automático
   - 8:00 AM COT = `0 13 * * *` UTC
   - 7:00 PM COT = `0 0 * * *` UTC (día siguiente en UTC)

## Contenido y Frecuencia (Batch por turno)

4. **Turno MAÑANA (8:00 AM)**: 9 publicaciones de producto
5. **Turno NOCHE (7:00 PM)**: 7 publicaciones de producto
6. **Orden dentro del batch**: Aleatorio
7. **Delay entre publicaciones**: 5 segundos
8. **Total diario**: 16 publicaciones (9 + 7)

## Reels (SUSPENDIDO)

9. **Estado**: Los reels están **suspendidos** en la automatización
10. **Motivo**: La Graph API de Instagram no permite republicar reels como Stories con el sticker "Ver reel". El endpoint `POST /media` con `video_url` rechaza los `media_url` devueltos por la propia Graph API (error `container ERROR`).
11. **Alternativa mientras tanto**: Compartir los reels manualmente desde la app mobile con el botón "Agregar a historia"
12. **Archivos conservados para reactivar en el futuro**:
    - `data/reels-config.json` (pool de shortcodes)
    - `data/reels-map.json` (cache shortcode → media_id)
    - `src/instagram/reels.js` (helpers)
    - `publishVideoStory()` en `src/instagram/publisher.js`

## Productos (Stories)

15. **Fuente**: Colección `best-sellers` de weloveluana.com (Shopify JSON pública)
16. **Cantidad total**: 83 productos disponibles (fetch con `limit=250`)
17. **Selección**: Aleatoria de todos los productos no publicados
18. **Reset de historial**: Cuando se acaban los productos sin publicar, se limpia el historial y se empieza de nuevo
19. **Variantes de color**: Si un producto tiene la opción "Color", se elige una variante de color al azar y se usa una imagen correspondiente a ese color
20. **URLs**: Siempre con UTMs: `?utm_source=instagram&utm_medium=organico&utm_campaign=post&utm_content=story`

## Diseño Visual de Stories de Producto

21. **Dimensiones**: 1080x1920 px, JPEG calidad 92%
22. **Layout**:
    - Imagen del producto: 80% superior
    - Zona de texto e info: 20% inferior
23. **Colores de marca** (5 plantillas que rotan aleatoriamente):
    - Amarillo: `#fffebe`
    - Azul claro: `#c8d5ed`
    - Beige: `#dbc9be`
    - Marrón: `#4f2c1d`
    - Azul oscuro: `#4c69b2`
24. **Tipografía**: Montserrat (Bold y Regular)
25. **Elementos visuales**:
    - Título del producto en mayúsculas
    - Precio original tachado arriba del precio final (si hay descuento)
    - Badge circular de descuento al lado derecho del precio final
    - Botón "COMPRAR AHORA"
    - Texto "weloveluana.com" en la parte inferior
26. **No escribir URLs completas sobre la imagen** (solo "weloveluana.com")

## Infraestructura Técnica

27. **Hosting de imágenes**: GitHub raw content (`raw.githubusercontent.com`) vía GitHub API
    - Se sube a `/media/`, se publica, se elimina tras publicar
28. **API de Instagram**: Graph API v19.0
    - `POST /{ig-user-id}/media` con `media_type=STORIES` + `image_url` (fotos)
    - `POST /{ig-user-id}/media` con `media_type=STORIES` + `video_url` (reels)
    - Polling del container hasta `FINISHED`
    - `POST /{ig-user-id}/media_publish` con `creation_id`
29. **API de Shopify**: JSON pública (`/collections/{handle}/products.json`) sin autenticación
30. **Historial**: Archivo `data/posted-history.json` commiteado al repo
    - `postedProducts`: productos publicados
    - `postedReels`: reels republicados (con timestamp para filtro intra-día)
31. **Estrategia de commit del historial**: `cp` + `reset --hard origin/main` + `cp` back (para evitar conflictos)
32. **Permisos necesarios del token de Instagram**:
    - `instagram_basic`
    - `instagram_content_publish`
    - `pages_show_list`

## Mantenimiento

33. **Token de Instagram**: expira cada 60 días, requiere renovación manual
34. **Commit del historial**: con `[skip ci]` para evitar loops
35. **Timeout del workflow**: 30 minutos (batch con 9 publicaciones + delays)
