FROM rust:latest

ARG UID=1000
ARG GID=1000

SHELL ["/bin/bash", "-c"]

# nvm environment variables
ENV NVM_VERSION 0.39.7
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 20.15.1

# install nvm
RUN mkdir -p $NVM_DIR \
    && curl --silent -o- https://raw.githubusercontent.com/creationix/nvm/v${NVM_VERSION}/install.sh | bash

# install node and npm
RUN source ${NVM_DIR}/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

# add node and npm to path so the commands are available
ENV NODE_PATH ${NVM_DIR}/v${NODE_VERSION}/lib/node_modules
ENV PATH      ${NVM_DIR}/versions/node/v${NODE_VERSION}/bin:$PATH

# confirm installation
RUN node -v
RUN npm -v

WORKDIR /usr/src/amaro

COPY deps/swc .

WORKDIR /usr/src/amaro/bindings/binding_typescript_wasm

RUN apt-get update && apt-get -y install cmake

RUN cargo install --locked wasm-pack

RUN ./scripts/build.sh

RUN mkdir -p /usr/src/amaro/swc

RUN cp -r pkg/* /usr/src/amaro/swc

# USER node
