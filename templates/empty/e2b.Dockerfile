# Minimal base image - no project files, blank slate
FROM node:20

# Ensure the /home/user/project directory exists (empty)
RUN mkdir -p /home/user/project

WORKDIR /home/user/project

# No COPY - starts completely empty
