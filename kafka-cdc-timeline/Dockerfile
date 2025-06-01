# Base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all other source code
COPY . .

# Expose ports
EXPOSE 3000
EXPOSE 6868

# Start the app
CMD ["node", "server.js"]
