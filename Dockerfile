# Use an official Alpine Linux base image
FROM alpine:3.21

# Set the working directory
WORKDIR /app

# Install dependencies
RUN apk update && apk add --no-cache python3 py3-pip ffmpeg sqlite

# Create and activate a virtual environment
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Create necessary directories
RUN mkdir -p /app/data/db

# Copy only the requirements file to leverage Docker cache
COPY requirements.txt /app/

# Upgrade pip and install any needed packages specified in requirements.txt
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . /app

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Copy the entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Run the entrypoint script when the container launches
ENTRYPOINT ["/entrypoint.sh"]