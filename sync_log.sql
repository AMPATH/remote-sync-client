use 'sync_log_db';
create table client_sync_log (
  id  INT(20) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  filename VARCHAR(100),
  uuid VARCHAR(50) UNIQUE,
  sequence_number INT(11) UNIQUE,
  datetime_run DATETIME default CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'success' COMMENT 'success|error',
  details TEXT DEFAULT NULL COMMENT 'used when there is an error'
);
