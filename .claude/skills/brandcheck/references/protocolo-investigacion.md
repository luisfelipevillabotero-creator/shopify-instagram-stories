# Protocolo de Investigación — /brandcheck

Objetivo: que TODA recomendación esté soportada. Distingue siempre lo verificado de lo
no verificable, y dilo en el informe.

## A. Fuentes oficiales de marcas — qué se puede y qué no

| Fuente | Consulta directa desde este entorno | Alternativa |
|---|---|---|
| SIPI / SIC (Colombia) | ❌ (aplicación JS, no fetchable) | WebSearch `"<nombre>" marca SIC registro` + marcar [NO CONFIRMADO] con instrucción: sipi.sic.gov.co → Signos distintivos → Buscar |
| WIPO Madrid Monitor | ❌ | WebSearch `"<nombre>" WIPO madrid trademark`; instruir verificación de designaciones a Colombia |
| EUIPO / TMview | ❌ (JS) | WebSearch `"<nombre>" trademark EUIPO` y `"<nombre>" site:tmdn.org` |
| USPTO | ⚠️ parcial | WebSearch `"<nombre>" trademark USPTO` — suele aparecer vía uspto.report / trademarkia (FUENTES SECUNDARIAS: cítalas como tales; el estado puede estar desactualizado) |
| UKIPO, OEPM, IMPI, INPI-BR, INPI-AR, INAPI, CIPO, IP Australia, IPONZ | ❌ | WebSearch dirigida por país; si nada aparece, reportar "sin hallazgos en fuentes abiertas — [NO CONFIRMADO]" |

**Regla:** ausencia de resultados en búsqueda web ≠ marca libre. Escríbelo así en el informe.

## B. Baterías de búsqueda web (lanzar en paralelo)

Ronda 1 — antecedentes y uso comercial (4–6 búsquedas simultáneas):
1. `"<nombre>" trademark registration USPTO EUIPO`
2. `"<nombre>" marca registrada` (+ país objetivo)
3. `"<nombre>" empresa OR startup OR company`
4. `"<nombre>" app OR software OR plataforma`
5. `"<nombre>" <sector del cliente>` (ej. inmobiliaria, fintech)
6. Variantes fonéticas evidentes: `"<variante1>" OR "<variante2>" trademark`

Ronda 2 — según hallazgos: profundizar en cada conflicto encontrado (quién es el titular,
qué clases cubre, en qué países opera, si tiene financiación/notoriedad), y noticias
(`"<nombre>" funding OR adquisición OR lawsuit`).

App stores: WebSearch `"<nombre>" app site:apps.apple.com OR site:play.google.com`.
GitHub (proyectos/orgs): WebSearch `"<nombre>" site:github.com` (la API directa suele estar
bloqueada por el proxy).

## C. Dominios — RDAP es la fuente autoritativa (NO uses DNS como prueba)

Ejecuta: `bash .claude/skills/brandcheck/scripts/check-digital.sh <nombre>`

El script consulta `rdap.org/domain/<dominio>` siguiendo redirecciones:
- **HTTP 200 → REGISTRADO** (extrae fecha de expiración si está en el JSON).
- **HTTP 404 → DISPONIBLE.**
- Otro código → NO CONFIRMABLE (repórtalo así).

TLDs por defecto: `.com .co .ai .io .app .dev`. ⚠️ La resolución DNS NO es prueba:
hay wildcards y dominios registrados sin DNS. Un dominio "disponible" puede estar en
subasta premium — si el informe lo amerita, sugerir verificación de precio en el registrador.

## D. Redes sociales — fiabilidad por plataforma

El script anterior también prueba handles. Interpreta con esta tabla:

| Red | Método | Fiabilidad |
|---|---|---|
| YouTube (`youtube.com/@handle`) | curl status: 404 = disponible, 200 = ocupado | ALTA ✅ |
| GitHub | Normalmente 403 por proxy | NULA → [NO CONFIRMADO] |
| TikTok | Devuelve 200 exista o no | NULA → [NO CONFIRMADO] |
| Instagram, Facebook, LinkedIn, X | Bloqueo anti-bot / login wall | NULA → [NO CONFIRMADO] |

Para las no confirmables: (1) busca indicios indirectos con WebSearch
(`"<nombre>" instagram`, `linkedin.com/company/<nombre>`); (2) si un conflicto corporativo
ya fue detectado, INFIERE que sus handles están tomados y márcalo [INFERENCIA];
(3) siempre deja la instrucción de verificación manual en el informe.

## E. SEO

Con los resultados de las búsquedas de la Ronda 1 evalúa:
- **Dominancia de la SERP:** ¿quién posee hoy los primeros resultados para el nombre exacto?
- **Volumen de colisión:** ¿el nombre es palabra común (millones de resultados) o término raro?
- **Confusión potencial:** ¿un cliente que busque la marca del usuario terminará en el sitio
  de un tercero? (crítico si hay homónimo financiado)
- **Facilidad de posicionamiento:** alta si el término es cuasi-único; baja si compite con
  una empresa establecida o con una frase genérica.

## F. Registro de limitaciones

Cierra la fase de investigación con una lista explícita de:
- Fuentes consultadas con éxito (y fecha).
- Fuentes NO consultables y qué debe verificarse manualmente antes de radicar
  (mínimo siempre: SIPI y Madrid Monitor para Colombia).
Esta lista va OBLIGATORIAMENTE en el informe final (sección Riesgos/Limitaciones).
