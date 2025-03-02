-- Định nghĩa biến thay thế cho tên người dùng
DEFINE user_name = 'TEST_USER';

-- Chuyển sang PDB (XEPDB1) để tạo user và thao tác
ALTER SESSION SET CONTAINER = XEPDB1;

-- Tạo user trong PDB
CREATE USER &user_name IDENTIFIED BY Abc12345;
GRANT CONNECT TO &user_name;

-- Cấp quyền tối thiểu cho user trong PDB để Debezium dùng LogMiner
GRANT EXECUTE ON DBMS_LOGMNR TO &user_name;
GRANT SELECT ANY TRANSACTION TO &user_name;
GRANT LOGMINING TO &user_name;
GRANT SELECT ON V_$LOG TO &user_name;
GRANT SELECT ON V_$LOGFILE TO &user_name;
GRANT SELECT ON V_$ARCHIVED_LOG TO &user_name;
GRANT SELECT ON V_$LOGMNR_CONTENTS TO &user_name;
GRANT SELECT ON V_$LOGMNR_LOGS TO &user_name;

-- Quyền bổ sung tùy chọn (dùng để debug nếu cần)
GRANT SELECT ON V_$DATABASE TO &user_name;
GRANT SELECT ON V_$INSTANCE TO &user_name;

-- Cấp quyền tạo bảng và thao tác dữ liệu cho user
GRANT RESOURCE TO &user_name;
GRANT UNLIMITED TABLESPACE TO &user_name;

-- Tạo bảng PRODUCT trong schema của &user_name
CREATE TABLE &user_name..PRODUCT (
  SHOP_CODE VARCHAR2(20) NOT NULL,
  JAN_CODE VARCHAR2(13) NOT NULL,
  QUANTITY NUMBER,
  PRICE NUMBER(10, 2),
  CREATED_DATE DATE,
  UPDATED_TS TIMESTAMP(6),
  EXPIRY_TS TIMESTAMP(6) WITH TIME ZONE,
  PRODUCT_NAME VARCHAR2(100),
  STATUS CHAR(1),
  IMAGE BLOB,
  DESCRIPTION CLOB,
  PRODUCT_ID RAW(16),
  CONSTRAINT PK_PRODUCT PRIMARY KEY (SHOP_CODE, JAN_CODE)
);

-- Chèn dữ liệu mẫu vào bảng PRODUCT
INSERT INTO &user_name..PRODUCT (
  SHOP_CODE, JAN_CODE, QUANTITY, PRICE, CREATED_DATE, UPDATED_TS, EXPIRY_TS,
  PRODUCT_NAME, STATUS, IMAGE, DESCRIPTION, PRODUCT_ID
) VALUES (
  'SHOP001',
  '4901234567890',
  100,
  99.99,
  TO_DATE('2025-02-21 14:30:00', 'YYYY-MM-DD HH24:MI:SS'),
  TO_TIMESTAMP('2025-02-21 14:30:00.123456', 'YYYY-MM-DD HH24:MI:SS.FF6'),
  TO_TIMESTAMP_TZ('2025-02-21 14:30:00.123456 +07:00', 'YYYY-MM-DD HH24:MI:SS.FF6 TZR'),
  'Sample Product',
  'Y',
  UTL_RAW.CAST_TO_RAW('Sample Image Data'),
  'This is a long product description...',
  SYS_GUID()
);

COMMIT;

-- Kiểm tra user và bảng đã được tạo chưa
BEGIN
  DBMS_OUTPUT.PUT_LINE('Checking if user ' || '&user_name' || ' exists...');
  FOR rec IN (SELECT username FROM dba_users WHERE username = UPPER('&user_name')) LOOP
    DBMS_OUTPUT.PUT_LINE('User ' || rec.username || ' created successfully.');
  END LOOP;
  DBMS_OUTPUT.PUT_LINE('Checking if table ' || '&user_name' || '.PRODUCT exists...');
  FOR rec IN (SELECT table_name FROM dba_tables WHERE owner = UPPER('&user_name') AND table_name = 'PRODUCT') LOOP
    DBMS_OUTPUT.PUT_LINE('Table ' || rec.table_name || ' created successfully.');
  END LOOP;
END;
/

EXIT;