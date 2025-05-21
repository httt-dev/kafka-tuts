from kafka import KafkaAdminClient
from kafka.admin import NewTopic
import cx_Oracle
import psycopg2
import time

# Hàm chờ Kafka sẵn sàng
def wait_for_kafka(bootstrap_servers, max_attempts=30, delay=5):
    for attempt in range(max_attempts):
        try:
            admin_client = KafkaAdminClient(bootstrap_servers=bootstrap_servers)
            admin_client.list_topics()  # Thử liệt kê topic để kiểm tra kết nối
            admin_client.close()
            print("Kafka is ready!")
            return True
        except Exception as e:
            print(f"Waiting for Kafka... Attempt {attempt + 1}/{max_attempts}: {e}")
            time.sleep(delay)
    raise Exception("Kafka not ready after max attempts")

# Chờ Kafka sẵn sàng
wait_for_kafka(bootstrap_servers='192.168.1.252:19092')

# Kết nối Kafka
admin_client = KafkaAdminClient(bootstrap_servers='192.168.1.252:19092')

# Lấy danh sách bảng từ Oracle
oracle_conn = cx_Oracle.connect(user='AIPDEV', password='Abc12345', dsn='192.168.1.116:1522/ORCLPDB1')
oracle_cursor = oracle_conn.cursor()
oracle_cursor.execute("SELECT table_name FROM all_tables WHERE owner = 'AIPDEV'")
oracle_tables = [row[0] for row in oracle_cursor.fetchall()]
oracle_cursor.close()
oracle_conn.close()

# Lấy danh sách bảng từ Postgres
pg_conn = psycopg2.connect(
    dbname='pg_bo_ut',
    user='hontorsp',
    password='Abc12345',
    host='192.168.1.122',
    port='5432'
)
pg_cursor = pg_conn.cursor()
pg_cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
pg_tables = [row[0] for row in pg_cursor.fetchall()]
pg_cursor.close()
pg_conn.close()

# Tạo topic cho Oracle
oracle_topics = [
    NewTopic(name=f'oracle.AIPDEV.{table}', num_partitions=1, replication_factor=1)
    for table in oracle_tables
]

# Tạo topic cho Postgres
pg_topics = [
    NewTopic(name=f'postgres.public.{table}', num_partitions=1, replication_factor=1)
    for table in pg_tables
]

# Tạo tất cả topic
admin_client.create_topics(oracle_topics + pg_topics, validate_only=False)
admin_client.close()

print("Topics created successfully!")