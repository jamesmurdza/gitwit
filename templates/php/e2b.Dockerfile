# Use the E2B base image
FROM e2bdev/code-interpreter:latest

# Install PHP and Apache
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
    php \
    php-cli \
    php-common \
    libapache2-mod-php \
    apache2 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js (which includes npm)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Clear npm cache to avoid conflicts
RUN npm cache clean --force

# Initialize npm and install Vite and the PHP plugin
WORKDIR /home/user/project
RUN npm init -y && \
    npm install --save-dev vite vite-plugin-php

# Enable Apache rewrite module
RUN a2enmod rewrite

# Configure Apache for the project directory
RUN echo '<VirtualHost *:80>\n\
    DocumentRoot /home/user/project\n\
    <Directory /home/user/project>\n\
    Options Indexes FollowSymLinks\n\
    AllowOverride All\n\
    Require all granted\n\
    </Directory>\n\
    </VirtualHost>' > /etc/apache2/sites-available/000-default.conf

# Set proper permissions for the project directory
RUN mkdir -p /home/user/project && \
    chown -R www-data:www-data /home/user/project && \
    chmod -R 755 /home/user/project

# Copy everything from the current directory into /home/user/project
COPY . /home/user/project

# Expose port 80
EXPOSE 80

# Start Apache 
CMD ["apache2-foreground"]


