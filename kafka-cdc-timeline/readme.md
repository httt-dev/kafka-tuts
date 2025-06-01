### Install modules
```bat
npm install 
npm install node-fetch@2
```
### Run app
```bat
npm start
```

### Build image 
```bat
docker rmi -f kafka-cdc-timeline-app

docker build -t kafka-cdc-timeline-app .
```

### Run container 
```bat
docker run --name ora2pg_cdc-timeline  --env-file .env  -p 3000:3000   -p 6868:6868  kafka-cdc-timeline-app
```

### Remove container 
```bat
docker rm -f ora2pg_cdc-timeline
```

### Check rep slot in postgres
```sql
SELECT * FROM pg_replication_slots;
SELECT pg_drop_replication_slot('debezium_slot_name');
```