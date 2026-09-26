# IA Local Coding Benchmark
## Contract v1.0

Fecha de congelación: 2026-09-23

## 1. Objetivo

Evaluar qué modelos locales resultan más fiables y útiles como asistentes reales de desarrollo de software.

No se evaluará únicamente si generan código sintácticamente plausible. Se medirán también:
- razonamiento autónomo,
- robustez,
- detección de casos límite,
- corrección funcional,
- calidad de tests,
- coherencia interna,
- reconocimiento de ambigüedades,
- tendencia a afirmar que algo está cubierto cuando realmente no lo está,
- rendimiento.

## 2. Participantes baseline

1. Qwen2.5-Coder 7B Q4_K_M
   - PC Windows
   - RTX 5070 Ti 16 GB
   - Ollama 0.34.3

2. Qwen3-Coder 30.5B Q4_K_M
   - MacBook Pro M2 Pro 32 GB
   - Ollama 0.34.2

3. Qwen3-Coder 30.5B Q5_K_M
   - MacBook Pro M2 Pro 32 GB
   - Ollama 0.34.2

Los modelos adicionales deberán ejecutar exactamente el mismo protocolo aplicable.

## 3. Condiciones de inferencia

- Endpoint: /api/generate
- stream: false
- Herramientas externas: ninguna
- num_ctx: 32768
- temperature: 0
- seed: 42
- num_predict: 4096
- keep_alive: 0
- Plantilla: la plantilla nativa de cada modelo
- Prompt visible: idéntico para todos los modelos de una misma prueba

No se utilizará raw=true.

## 4. Estado previo

Siempre que se mida carga en frío:
- comprobar /api/ps antes de la ejecución,
- confirmar que el modelo evaluado no está residente,
- no realizar una generación de calentamiento antes de esa medición.

## 5. Validez de una ejecución

Una ejecución es válida solamente si:
- el prompt realmente fue enviado,
- existe una respuesta,
- done_reason indica una finalización normal,
- la respuesta no fue truncada por num_predict,
- no hubo error de conexión, parser o API.

Una ejecución con:
- prompt vacío,
- done_reason=unload causado por prompt vacío,
- done_reason=length,
- error del servidor,
queda descartada y debe repetirse sin contabilizarse.

## 6. Tres niveles de evaluación

### A. Requisitos inequívocos

Son requisitos explícitos del prompt.

Un incumplimiento cuenta como fallo directo.

Ejemplos:
- firma de función solicitada,
- validación solicitada,
- redondeo solicitado,
- ausencia de librerías externas cuando así se especifica.

### B. Inferencias razonables de ingeniería

No se enumeran explícitamente al modelo.

Sirven para evaluar si el modelo razona como un ingeniero y no únicamente traduce literalmente el prompt.

Ejemplos:
- NaN,
- Infinity y -Infinity,
- rangos semánticamente razonables,
- contradicciones de dominio,
- casos límite derivados del lenguaje,
- ambigüedades que deberían ser detectadas o explicadas,
- limitaciones numéricas relevantes.

Estos resultados se registran separadamente de los requisitos explícitos.

### C. Decisiones no especificadas

No se penalizará al modelo por escoger razonablemente una alternativa que el prompt no haya definido.

Ejemplos:
- Number frente a string para representar "24.28",
- Error frente a TypeError o RangeError,
- política concreta para un carrito vacío,
- decisión de permitir cantidades fraccionarias cuando el dominio sea ambiguo, siempre que la decisión sea razonada.

## 7. Tests generados por el propio modelo

Se evaluarán independientemente del código principal.

Comprobar:
- si los valores esperados son matemáticamente correctos,
- si los tests realmente prueban lo que el modelo afirma,
- duplicaciones innecesarias,
- cobertura de validaciones,
- contradicciones entre comentarios y assertions,
- tests que fallan contra una implementación correcta,
- falsa afirmación de cobertura.

Los tests creados por el modelo NO constituyen los tests de referencia.

## 8. Tests externos ocultos

Los tests de referencia:
- serán definidos antes de probar modelos adicionales,
- serán idénticos para todos,
- no aparecerán en el prompt,
- no serán generados por ninguno de los modelos participantes.

Los tests distinguirán entre categorías A, B y C.

## 9. Rendimiento

Registrar por ejecución:
- model,
- done_reason,
- load_duration,
- prompt_eval_count,
- prompt_eval_duration,
- eval_count,
- eval_duration.

Calcular posteriormente:
- tokens/s de generación,
- tiempo de carga,
- tiempo total,
- relación calidad/rendimiento.

La velocidad nunca sustituirá la evaluación de corrección y fiabilidad.

## 10. Regla de selección

No se seleccionará un modelo por:
- número de parámetros,
- cuantización,
- tokens/s,
- reputación,
- benchmark del fabricante,
- una única tarea.

La selección final deberá basarse en varias tareas representativas del entorno real de desarrollo.

## 11. Familias de pruebas previstas

- generación desde requisitos,
- revisión de código defectuoso,
- debugging,
- diseño y generación de tests,
- seguridad y validación,
- modificación de código existente,
- tareas multiarchivo/repositorio en una fase posterior.

## 12. Resultado de cart-total-v1 observado hasta ahora

Se han detectado ya diferencias entre los tres modelos baseline, incluyendo:
- omisión de casos límite numéricos,
- diferencias en validación semántica,
- tests generados con resultados matemáticos incorrectos,
- discrepancias entre cobertura afirmada y cobertura real.

Estos resultados NO modificarán los criterios de los tests externos que se congelen a continuación.
