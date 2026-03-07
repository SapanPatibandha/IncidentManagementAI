import { FastifyRequest, FastifyReply } from 'fastify';

export function errorHandler(error: any, request: FastifyRequest, reply: FastifyReply) {
  reply.code(error.statusCode || 500).send({
    error: error.name || 'InternalServerError',
    message: error.message || 'An error occurred',
    statusCode: error.statusCode || 500,
  });
}