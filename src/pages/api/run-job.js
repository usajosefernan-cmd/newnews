export const prerender = false;
import { spawn } from 'node:child_process';
import path from 'node:path';

export async function POST({ request }) {
  let job = '';
  try {
    const data = await request.json();
    job = data.job || '';
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Cuerpo de petición inválido.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const validJobs = ['cron', 'radar', 'ai', 'sync', 'build'];
  if (!validJobs.includes(job)) {
    return new Response(JSON.stringify({ success: false, error: 'Trabajo no válido.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Crear canal de stream para enviar stdout/stderr en tiempo real
  const stream = new ReadableStream({
    async start(controller) {
      const send = (dataObj) => {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(dataObj) + '\n'));
      };

      send({ status: 'info', message: `🚀 [INICIO] Iniciando ejecución manual del trabajo: ${job.toUpperCase()}` });
      
      // Mostrar proveedor de IA / Clave
      const hasApiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
      send({ 
        status: 'info', 
        message: `🤖 [PROVEEDOR IA] ${hasApiKey ? 'Motor Gemini API Activo (gemini-2.5-flash)' : 'Base de datos estática local de España (Modo Sin Conexión)'}` 
      });

      let cmd = 'node';
      let args = [];

      if (job === 'cron') {
        args = ['scripts/hermes-cron.js'];
      } else if (job === 'radar') {
        args = ['scripts/radar-cron.js'];
      } else if (job === 'ai') {
        args = ['scripts/ai-pipeline.js'];
      } else if (job === 'sync') {
        args = ['scripts/sync.js'];
      } else if (job === 'build') {
        cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        args = ['run', 'build'];
      }

      send({ status: 'info', message: `💻 [COMANDO] Ejecutando: ${cmd} ${args.join(' ')}` });

      try {
        const child = spawn(cmd, args, { env: process.env, shell: true });

        child.stdout.on('data', (data) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              send({ status: 'info', message: line.replace(/\r/g, '') });
            }
          }
        });

        child.stderr.on('data', (data) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              send({ status: 'warn', message: `[STDERR] ${line.replace(/\r/g, '')}` });
            }
          }
        });

        child.on('close', (code) => {
          if (code === 0) {
            send({ status: 'success', message: `🎉 [ÉXITO] El proceso ha finalizado correctamente (código de salida 0).` });
          } else {
            send({ status: 'error', message: `❌ [FALLO] El proceso terminó con el código de salida ${code}.` });
          }
          controller.close();
        });

        child.on('error', (err) => {
          send({ status: 'error', message: `❌ [ERROR EJECUCIÓN] No se pudo lanzar el subproceso: ${err.message}` });
          controller.close();
        });

      } catch (err) {
        send({ status: 'error', message: `❌ [ERROR FATAL] ${err.message}` });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
