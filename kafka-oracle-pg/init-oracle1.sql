-- Định nghĩa biến thay thế cho tên người dùng
DEFINE user_name = 'TEST_USER';

-- Đảm bảo đang ở CDB$ROOT để thực hiện các thay đổi toàn cục
ALTER SESSION SET CONTAINER = CDB$ROOT;

-- Tạo user với biến
BEGIN
  EXECUTE IMMEDIATE 'CREATE USER ' || '&user_name' || ' IDENTIFIED BY Abc12345';
END;
GRANT CONNECT TO &user_name;

-- Tắt CDB để bật ARCHIVELOG
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;

-- Đảm bảo instance recovery hoàn tất trước khi bật ARCHIVELOG
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE CANCEL;
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;

-- Bật Supplemental Logging ở CDB
ALTER DATABASE ADD SUPPLEMENTAL LOG DATA;
ALTER DATABASE ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;
ALTER DATABASE ADD SUPPLEMENTAL LOG DATA (PRIMARY KEY) COLUMNS;

-- Chuyển sang PDB (XEPDB1), không cần mở vì đã mở tự động khi CDB mở
ALTER SESSION SET CONTAINER = XEPDB1;

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

EXIT;