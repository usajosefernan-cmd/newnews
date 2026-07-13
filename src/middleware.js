// Middleware pasante - evita que Astro inyecte su middleware virtual
// que falla con 'sequence is not a function' por conflicto con el workspace padre
export const onRequest = (context, next) => next();
