CREATE TABLE floors (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	floor_number SMALLINT NOT NULL,
	status TEXT DEFAULT 'active' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_floors PRIMARY KEY (id),
	CONSTRAINT ck_floors_status CHECK (status IN ('active','inactive')),
	CONSTRAINT ck_floors_number CHECK (floor_number BETWEEN 0 AND 200),
	CONSTRAINT ck_floors_row_version CHECK (row_version >= 1),
	CONSTRAINT uq_floors_floor_number UNIQUE (floor_number)
);

CREATE TABLE physical_rooms (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	floor_id UUID NOT NULL,
	room_code VARCHAR(80) NOT NULL,
	status TEXT DEFAULT 'active' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_physical_rooms PRIMARY KEY (id),
	CONSTRAINT ck_physical_rooms_status CHECK (status IN ('active','inactive')),
	CONSTRAINT ck_physical_rooms_room_code CHECK (length(btrim(room_code)) > 0),
	CONSTRAINT ck_physical_rooms_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_physical_rooms_floor_id_floors FOREIGN KEY(floor_id) REFERENCES floors (id) ON DELETE RESTRICT
);

CREATE INDEX ix_physical_rooms_floor_id ON physical_rooms (floor_id);

CREATE UNIQUE INDEX uq_physical_rooms_code ON physical_rooms (floor_id, lower(room_code));

CREATE TABLE exam_rooms (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	physical_room_id UUID NOT NULL,
	status TEXT DEFAULT 'ready' NOT NULL,
	rows SMALLINT DEFAULT '0' NOT NULL,
	columns SMALLINT DEFAULT '0' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_exam_rooms PRIMARY KEY (id),
	CONSTRAINT ck_exam_rooms_status CHECK (status IN ('ready','maintenance','inactive')),
	CONSTRAINT uq_exam_rooms_physical UNIQUE (physical_room_id),
	CONSTRAINT ck_exam_rooms_layout CHECK ((rows = 0 AND columns = 0) OR (rows BETWEEN 1 AND 100 AND columns BETWEEN 1 AND 100 AND rows * columns <= 1000)),
	CONSTRAINT ck_exam_rooms_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_exam_rooms_physical_room_id_physical_rooms FOREIGN KEY(physical_room_id) REFERENCES physical_rooms (id) ON DELETE RESTRICT
);

CREATE INDEX ix_exam_rooms_physical_room_id ON exam_rooms (physical_room_id);

CREATE TABLE room_seats (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	exam_room_id UUID NOT NULL,
	row_number SMALLINT NOT NULL,
	column_number SMALLINT NOT NULL,
	seat_code VARCHAR(16) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_room_seats PRIMARY KEY (id),
	CONSTRAINT ck_room_seats_coordinates CHECK (row_number > 0 AND column_number > 0),
	CONSTRAINT uq_room_seats_position UNIQUE (exam_room_id, row_number, column_number),
	CONSTRAINT uq_room_seats_code UNIQUE (exam_room_id, seat_code),
	CONSTRAINT ck_room_seats_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_room_seats_exam_room_id_exam_rooms FOREIGN KEY(exam_room_id) REFERENCES exam_rooms (id) ON DELETE RESTRICT
);

CREATE INDEX ix_room_seats_exam_room_id ON room_seats (exam_room_id);

CREATE TABLE computer_devices (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	computer_code VARCHAR(80) NOT NULL,
	serial_number VARCHAR(120) NOT NULL,
	ip_address INET NOT NULL,
	mac_address MACADDR NOT NULL,
	seat_id UUID,
	status TEXT DEFAULT 'ready' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_computer_devices PRIMARY KEY (id),
	CONSTRAINT ck_computer_devices_status CHECK (status IN ('ready','maintenance','inactive')),
	CONSTRAINT uq_computer_devices_seat UNIQUE (seat_id),
	CONSTRAINT ck_computer_devices_ipv4 CHECK (family(ip_address) = 4 AND masklen(ip_address) = 32),
	CONSTRAINT ck_computer_devices_row_version CHECK (row_version >= 1),
	CONSTRAINT uq_computer_devices_ip_address UNIQUE (ip_address),
	CONSTRAINT uq_computer_devices_mac_address UNIQUE (mac_address),
	CONSTRAINT fk_computer_devices_seat_id_room_seats FOREIGN KEY(seat_id) REFERENCES room_seats (id) ON DELETE RESTRICT
);

CREATE INDEX ix_computer_devices_seat_id ON computer_devices (seat_id);

CREATE UNIQUE INDEX uq_computer_devices_code ON computer_devices (lower(computer_code));

CREATE UNIQUE INDEX uq_computer_devices_serial ON computer_devices (lower(serial_number));
