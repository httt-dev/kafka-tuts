#!/bin/bash

# Khởi động Oracle trong background
echo "Starting Oracle in the background..."
/opt/oracle/runOracle.sh &

# Đợi Oracle sẵn sàng lần đầu (instance khởi động và database mở)
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

# Đợi thêm để đảm bảo database ổn định
echo "Oracle is initially ready, waiting for full stabilization..."
sleep 20

# Tắt database và đưa về trạng thái MOUNT để cấu hình ARCHIVELOG
echo "Configuring ARCHIVELOG and Supplemental Logging..."
sqlplus -s / as sysdba <<EOF
   WHENEVER SQLERROR EXIT FAILURE;
   set serveroutput on;
   shutdown immediate;
   startup mount;
   alter database archivelog;
   alter database open;
   -- Bật Supplemental Logging
   declare
     v_supp_log varchar2(20);
   begin
     select supplemental_log_data_min into v_supp_log from v\$database;
     if v_supp_log = 'NO' then
       execute immediate 'alter database add supplemental log data';
       execute immediate 'alter database add supplemental log data (all) columns';
       execute immediate 'alter database add supplemental log data (primary key) columns';
       dbms_output.put_line('Supplemental Logging enabled.');
     else
       dbms_output.put_line('Supplemental Logging already enabled.');
     end if;
   end;
   /
EOF

# Kiểm tra lỗi từ bước cấu hình
if [ $? -ne 0 ]; then
  echo "Error: ARCHIVELOG and Supplemental Logging configuration failed!"
  exit 1
fi

# Chạy script khởi tạo user và quyền
echo "Oracle is fully ready, executing initialization script..."
sqlplus -s / as sysdba <<EOF
   WHENEVER SQLERROR EXIT FAILURE;
   set serveroutput on;
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