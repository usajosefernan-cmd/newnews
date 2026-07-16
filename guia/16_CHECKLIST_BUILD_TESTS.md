# CHECKLIST GENERAL DE BUILD, TEST Y SEGURIDAD

## Antes de tocar código

```text
- Leer fase actual.
- Confirmar archivos permitidos.
- Confirmar archivos prohibidos.
- Hacer plan breve.
- Si el cambio excede la fase, parar y preguntar.
```

## Después de tocar código

Ejecutar:

```bash
npm run build
```

Si existen:

```bash
npm run test
npm run lint
```

Probar scripts si aplica:

```bash
node scripts/newnews-engine/run-daily.js --dry-run
node scripts/newnews-engine/run-hourly.js --dry-run
node scripts/newnews-engine/run-manual-item.js --dry-run --text "claim de prueba"
```

## Entrega obligatoria de Antigravity

```text
FASE COMPLETADA: [número y nombre]

Archivos tocados:
- ...

Qué cambió:
- ...

Qué NO se tocó:
- ...

Comandos ejecutados:
- ...

Resultado:
- build: OK/ERROR
- test: OK/ERROR/no existe
- dry-run: OK/ERROR/no aplica

Riesgos:
- ...

Siguiente fase recomendada:
- ...

STOP: no avanzo sin aprobación.
```

## Señales de peligro

Antigravity debe parar si necesita:

```text
- tocar muchas rutas públicas,
- cambiar arquitectura completa,
- borrar datos,
- cambiar provider de IA,
- instalar paquetes grandes,
- modificar deploy,
- activar crons,
- publicar contenido real,
- reescribir admin entero,
- tocar auth/permisos.
```

## Criterio de estabilidad

La fase solo está aceptada si:

```text
- compila,
- no rompe la web visible salvo fase de UX aprobada,
- no publica nada automático,
- deja logs o documentación,
- se puede revertir mentalmente por archivos tocados,
- respeta STOP gate.
```


## Checklist adicional Live

Cuando la fase sea Live, comprobar también:

```text
- LIVE_ENABLED=false salvo activación aprobada.
- Micrófono solo tras gesto y consentimiento.
- Indicador visible de escucha.
- Stop corta el stream.
- Audio no persistido por defecto.
- Transcript no persistido sin consentimiento.
- No hay claves en el bundle.
- Partial y final no se confunden.
- Eventos tienen secuencia e idempotencia.
- Un agente caído no bloquea la sesión.
- Hay timeout, cancelación y backpressure.
- Wake-only no habla sin invocación.
- Silent no sintetiza voz.
- El límite de coste funciona.
- Un claim Live no se publica.
- Borrar sesión elimina lo definido por la política.
- El transcript se trata como contenido no confiable.
```

Pruebas orientativas:

```bash
npm run build
npm run test
npm run lint
# usar scripts reales definidos por Antigravity según el framework
# ejecutar simulador Live y prueba end-to-end en modo local
```
