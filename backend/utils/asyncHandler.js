// utils/asyncHandler.js
// Express 4 n'attrape pas automatiquement les erreurs des fonctions async.
// Sans ce wrapper, une erreur dans une route (ex: coupure réseau avec Turso)
// peut faire planter TOUT le serveur pour tous les utilisateurs. Ce wrapper
// transmet l'erreur au gestionnaire global défini dans server.js à la place.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
