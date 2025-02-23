#!/bin/bash

# Khởi động Oracle trong background để không chặn script
echo "Starting Oracle in the background..."
/opt/oracle/runOracle.sh &

# Đợi Oracle sẵn sàng
echo "Waiting for Oracle to be ready..."
until sqlplus -s / as sysdba <<EOF
   WHENEVER SQLERROR EXIT FAILURE;
   select 1 from dual;
   exit;
EOF
do
  echo "Oracle is not ready yet, retrying in 5 seconds..."
  sleep 5
done

# Khi Oracle sẵn sàng, chạy script khởi tạo
echo "Oracle is ready, executing initialization script..."
sqlplus -s / as sysdba <<EOF
   WHENEVER SQLERROR EXIT FAILURE;
   @/docker-entrypoint-initdb.d/init-oracle.sql
EOF

# Kiểm tra lỗi từ script SQL
if [ $? -ne 0 ]; then
  echo "Error: Initialization script failed!"
  exit 1
fi

echo "Initialization complete!"

# Giữ container chạy bằng cách đợi process nền của Oracle
wait