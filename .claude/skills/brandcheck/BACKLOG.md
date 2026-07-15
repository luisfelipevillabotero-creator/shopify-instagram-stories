# Backlog — Comandos futuros del agente de naming

Estado: `/brandcheck` construido (v1.0). Los siguientes comandos reutilizarán los mismos
módulos (identidad de comité, marco jurídico, protocolo de investigación, motores,
matriz y plantilla) de `.claude/skills/brandcheck/references/`.

| Comando | Función | Módulos que reutiliza | Trabajo nuevo |
|---|---|---|---|
| `/brandcreate` | Genera 50–200 nombres a partir de un briefing | 4, 5 | Plantilla de briefing + estrategias generativas (raíces, familias, patrones benchmark) + filtro rápido (--quick) |
| `/brandcompare` | Compara hasta 10 marcas y recomienda | Todos | Modo batch de la matriz + tabla comparativa |
| `/brandportfolio` | Evalúa y ordena un portafolio por potencial | Todos | Ranking + detección de canibalización/solapamiento de clases |
| `/brandglobal` | Viabilidad de expansión país por país | 2 (internacional), 3 | Matriz por jurisdicción + estrategia Madrid |
| `/brandidentity` | Personalidad, tono, valores, posicionamiento, narrativa | 5 | Framework de identidad verbal |
| `/branddomain` | Solo dominios, redes y presencia digital | 3, 6 | Ampliar TLDs y plataformas del script |
| `/brandrisk` | Análisis jurídico profundo de riesgos | 2, 3 | Cotejo extendido, oposiciones probables, escenarios de litigio |
| `/brandimprove` | Versiones de una marca existente con más distintividad | 4, 8 | Estrategias de refuerzo (aglutinación, acuñación, arquitectura) |
| `/brandstrategy` | Arquitectura de marca completa (madre, submarcas, convenciones, expansión) | Todos | Framework de arquitectura (monolítica/endosada/independiente) |

Convención: cada comando nuevo = carpeta `.claude/skills/<nombre>/SKILL.md` que referencia
los archivos compartidos de `brandcheck/references/` en lugar de duplicarlos.
