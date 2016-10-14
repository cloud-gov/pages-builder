const Hapi = require("hapi")
const winston = require("winston")

const server = (cluster) => {
  const server = new Hapi.Server()

  server.connection({ port: process.env.PORT || 8080 })

  server.route({
    method: "GET",
    path: "/",
    handler: (request, reply) => {
      const response = reply('Server running')
      response.type('text/plain')
      response.statusCode = 200

      winston.info("GET %s - 200", request.url.path)
    }
  })

  server.route({
    method: "DELETE",
    path: "/builds/{buildID}/callback",
    handler: (request, reply) => {
      try {
        cluster.stopBuild(request.params.buildID)
      } catch (error) {
        winston.error("Error stopping build" + request, error)
      }

      const response = reply('Callback registered')
      response.type('text/plain')
      response.statusCode = 200

      winston.info("GET %s - 200", request.url.path)
    },
  })

  return server
}

module.exports = server
