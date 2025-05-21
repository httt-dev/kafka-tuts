FROM python:3.9

# Cài đặt các công cụ cần thiết
RUN apt-get update && apt-get install -y \
    libaio1 \
    unzip \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Tải và cài đặt Oracle Instant Client
ENV ORACLE_CLIENT_VERSION=21.13
RUN mkdir -p /opt/oracle \
    && wget -q https://download.oracle.com/otn_software/linux/instantclient/2113000/instantclient-basiclite-linux.x64-21.13.0.0.0dbru.zip -O /tmp/instantclient.zip \
    && unzip /tmp/instantclient.zip -d /opt/oracle \
    && rm /tmp/instantclient.zip \
    && echo "/opt/oracle/instantclient_21_13" > /etc/ld.so.conf.d/oracle-instantclient.conf \
    && ldconfig

# Thiết lập biến môi trường
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_21_13:$LD_LIBRARY_PATH

# Cài đặt thư viện Python
COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt

# Copy script
COPY create_topics.py /create_topics.py

# Command
CMD ["bash", "-c", "python /create_topics.py && tail -f /dev/null"]