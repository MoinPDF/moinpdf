FROM node:24-alpine
WORKDIR /service
COPY server.mjs handler.mjs transfer.mjs timestamp.mjs ./
USER node
EXPOSE 8766
CMD ["node", "server.mjs"]
