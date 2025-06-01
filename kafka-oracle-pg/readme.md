### Thiết lập CDC cho PostgreSQL 

Kích hoạt Logical Replication

Mở file cấu hình postgresql.conf của PostgreSQL (thường nằm ở /etc/postgresql/<version>/main/postgresql.conf hoặc /var/lib/pgsql/data/postgresql.conf).
```bat	
 	sudo nano /var/lib/pgsql/17/data/postgresql.conf
```

Edit nội dung : 
```bat
wal_level = logical
max_replication_slots = 5  # Số lượng slot replication tối đa (tùy nhu cầu)
max_wal_senders = 4       # Số lượng kết nối replication tối đa
```

Lưu file và khởi động lại PostgreSQL
```bat
sudo systemctl restart  postgresql-17
```

Cấu hình để có thể replica thông tin cho các table
```sql
ALTER TABLE table_name replica identity FULL;
```
Khi cấu hình là FULL thì trong trường hợp Update mới có giá trị cũ và mới.

Thiết lập cho toàn bộ các table : 
```sql
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I REPLICA IDENTITY FULL',
            r.schemaname,
            r.tablename
        );
    END LOOP;
END $$;
```
—-----------------------Lấy các table + partition table
```sql
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
```
—-----------------------Lấy các partition table
```sql
SELECT n.nspname AS schemaname, c.relname AS tablename
FROM pg_inherits i
JOIN pg_class c ON i.inhrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND c.relkind = 'r';  -- chỉ lấy bảng (table), không lấy index, view, v.v.
```
—-----------------------Kiểm tra replica của các table
```sql
SELECT
    n.nspname AS schema,
    c.relname AS table,
    CASE c.relreplident
        WHEN 'd' THEN 'DEFAULT'
        WHEN 'n' THEN 'NOTHING'
        WHEN 'f' THEN 'FULL'
        WHEN 'i' THEN 'INDEX'
    END AS replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema');

```
—----------------------------- Thu hồi lại replica
```sql
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I REPLICA IDENTITY DEFAULT',
            r.schemaname,
            r.tablename
        );
    END LOOP;
END $$;
```

### Thiết lập CDC cho Oracle 
```sql
-- Bật archivelog

    set serveroutput on;
    shutdown immediate;
    startup mount;
    alter database archivelog;
    alter database open;

-- Bật Supplemental Logging
    alter database add supplemental log data;
    alter database add supplemental log data (all) columns;
    alter database add supplemental log data (primary key) columns;

-- Thiết lập quyền cho user để có thể đọc log 

```

### Liệt kê các topic 

```bat
docker exec -it kafka kafka-topics --list  --bootstrap-server kafka:9092
```



### Kiem tra slot trong postgres
Nếu có lỗi liên quan đến REPLICATION của user 

```sql
SELECT usename, usesuper, userepl FROM pg_user WHERE usename = 'postgres';

--Nếu mất quyền rep thì cấp lại : 
-- ALTER ROLE postgres WITH REPLICATION;

 -- Kiểm tra replication slot (nếu bị xóa hoặc lỗi)
 -- active = false → Slot bị hỏng.
SELECT * FROM pg_replication_slots;
SELECT pg_drop_replication_slot('debezium_slot');
```
