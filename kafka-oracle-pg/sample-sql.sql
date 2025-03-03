CREATE TABLE TEST_USER.PRODUCT_NO_LOB (
    PRODUCT_ID NUMBER(5),
    SHOP_CODE VARCHAR2(50),
    JAN_CODE VARCHAR2(50),
    QUANTITY NUMBER(8),
    PRICE NUMBER(10,4),
    CREATED_DATE DATE,
    UPDATED_TS TIMESTAMP,
    PRIMARY KEY (PRODUCT_ID)
);


-- POSTGRES
CREATE TABLE public.PRODUCT_NO_LOB (
    PRODUCT_ID INTEGER,
    SHOP_CODE VARCHAR(50),
    JAN_CODE VARCHAR(50),
    QUANTITY BIGINT,
    PRICE NUMERIC(10,4),
    CREATED_DATE DATE,
    UPDATED_TS TIMESTAMP,
    PRIMARY KEY (PRODUCT_ID)
);






CREATE TABLE TEST_USER.PRODUCT (
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


CREATE TABLE public.PRODUCT (
  SHOP_CODE VARCHAR(20) NOT NULL,
  JAN_CODE VARCHAR(13) NOT NULL,
  QUANTITY NUMERIC,
  PRICE NUMERIC(10, 2),
  CREATED_DATE DATE,
  UPDATED_TS TIMESTAMP(6),
  EXPIRY_TS TIMESTAMP(6) WITH TIME ZONE,
  PRODUCT_NAME VARCHAR(100),
  STATUS CHAR(1),
  IMAGE BYTEA,
  DESCRIPTION TEXT,
  PRODUCT_ID BYTEA,
  CONSTRAINT PK_PRODUCT PRIMARY KEY (SHOP_CODE, JAN_CODE)
);