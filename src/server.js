const Hapi = require("hapi")

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
    }
  })

  server.route({
    method: "DELETE",
    path: "/builds/{buildID}/callback",
    handler: (request, reply) => {
      try {
        cluster.stopBuild(request.params.buildID)
      } catch (error) {
        console.error("Error stopping build: " + request.params.buildID)
        console.error(error)
      }

      const response = reply('Callback registered')
      response.type('text/plain')
      response.statusCode = 200
    },
  })

  return server
}

module.exports = server
