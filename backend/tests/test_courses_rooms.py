from uuid import uuid4

import pytest

from tests.test_auth_academic import create_staff

pytestmark = pytest.mark.postgres


def catalog(client, headers):
    teacher, faculty, department = create_staff(client, headers)
    major = client.post('/api/v1/academic/majors', headers=headers, json={'departmentId': department['id'], 'code': 'INET-DE', 'name': 'สาขาทดสอบ'}).json()
    groups = [client.post('/api/v1/academic/class-groups', headers=headers, json={'majorId': major['id'], 'admissionYear': 2567}).json() for _ in range(2)]
    students = []
    for index, group in enumerate(groups):
        code = f'670101150016{index}'
        response = client.post('/api/v1/users', headers=headers, json={'role': 'student', 'email': f's{code}@email.kmutnb.ac.th', 'fullName': f'นักศึกษาทดสอบ {index}',
                        'profile': {'studentCode': code, 'majorId': major['id'], 'admissionYear': 2567, 'classGroupId': group['id']}})
        assert response.status_code == 201, response.text
        students.append(response.json())
    course = client.post('/api/v1/courses', headers=headers, json={'code': 'CS301', 'name': 'ทดสอบรายวิชา', 'departmentId': department['id']}).json()
    return teacher, major, groups, students, course


def section_payload(teacher, major, group, course, number=1):
    return {'courseId': course['id'], 'academicYear': 2569, 'semester': '1', 'sectionNumber': number, 'primaryTeacherId': teacher['id'],
            'cohorts': [{'majorId': major['id'], 'admissionYear': 2567, 'classGroupIds': [group['id']]}]}


def test_whole_group_collisions_and_roster_moves(client, admin_account):
    _, headers = admin_account
    teacher, major, groups, students, course = catalog(client, headers)
    payload = section_payload(teacher, major, groups[0], course)
    first = client.post('/api/v1/sections', headers=headers, json=payload)
    assert first.status_code == 201, first.text
    first = first.json()
    whole = {**payload, 'sectionNumber': 2, 'cohorts': [{'majorId': major['id'], 'admissionYear': 2567}]}
    assert client.post('/api/v1/sections', headers=headers, json=whole).status_code == 409
    assert client.post('/api/v1/sections', headers=headers, json={**payload, 'coTeacherIds': [teacher['id']]}).status_code == 422
    second = client.post('/api/v1/sections', headers=headers, json=section_payload(teacher, major, groups[1], course, 2)).json()
    assert second['studentCount'] == 1
    response = client.post(f'/api/v1/sections/{second["id"]}/roster/inclusions', headers=headers, json={'studentId': students[0]['id']})
    assert response.status_code == 409
    response = client.post(f'/api/v1/sections/{first["id"]}/roster/moves', headers={**headers, 'Idempotency-Key': str(uuid4())},
                           json={'targetSectionId': second['id'], 'studentId': students[0]['id']})
    assert response.status_code == 200, response.text
    assert response.json()['source']['studentCount'] == 0 and response.json()['target']['studentCount'] == 2
    student = client.get(f'/api/v1/users/{students[0]["id"]}', headers=headers).json()
    assert student['profile']['classGroupId'] == groups[0]['id']
    assert client.get(f'/api/v1/sections/{second["id"]}/roster/candidates?q=6', headers=headers).status_code == 422
    next_semester = client.post('/api/v1/sections', headers=headers, json={**payload, 'semester': '2'})
    assert next_semester.status_code == 201, next_semester.text
    response = client.post(f'/api/v1/sections/{second["id"]}/roster/moves', headers={**headers, 'Idempotency-Key': str(uuid4())},
                           json={'targetSectionId': next_semester.json()['id'], 'studentId': students[0]['id']})
    assert response.status_code == 422


def test_layout_stable_ids_catalog_uniqueness_and_unknown(client, admin_account):
    _, headers = admin_account
    floor = client.post('/api/v1/rooms/floors', headers=headers, json={'floorNumber': 4}).json()
    physical = client.post('/api/v1/rooms/physical-rooms', headers=headers, json={'floorId': floor['id'], 'suffix': '08'}).json()
    assert physical['roomCode'] == 'B4-08'
    room = client.post('/api/v1/rooms/exam-rooms', headers=headers, json={'physicalRoomId': physical['id']}).json()
    response = client.post('/api/v1/rooms/exam-rooms', headers=headers, json={'physicalRoomId': physical['id']})
    assert response.status_code == 409
    room = client.put(f'/api/v1/rooms/exam-rooms/{room["id"]}/layout', headers=headers, json={'rows': 1, 'columns': 1, 'expectedVersion': 1}).json()
    seat = room['seats'][0]
    response = client.post('/api/v1/devices', headers=headers, json={'computerCode': 'PC001', 'serialNumber': 'SER001', 'ipAddress': '192.168.1.10', 'macAddress': '00:11:22:33:44:55', 'seatId': seat['id']})
    assert response.status_code == 201, response.text
    device = response.json()
    assert device['runtimeStatus'] == 'unknown' and device['isAssignable'] is True
    summaries = client.get('/api/v1/rooms/exam-rooms', headers=headers).json()['items']
    assert summaries[0]['computerCount'] == 1 and 'seats' not in summaries[0]
    assert client.post('/api/v1/devices', headers=headers, json={'computerCode': 'PC002', 'serialNumber': 'SER002', 'ipAddress': '192.168.1.11', 'macAddress': '00:11:22:33:44:56', 'seatId': seat['id']}).status_code == 409
    assert client.put(f'/api/v1/rooms/exam-rooms/{room["id"]}/layout', headers=headers, json={'rows': 0, 'columns': 0, 'expectedVersion': 2}).status_code == 409
    expanded = client.put(f'/api/v1/rooms/exam-rooms/{room["id"]}/layout', headers=headers, json={'rows': 2, 'columns': 2, 'expectedVersion': 2})
    assert expanded.status_code == 200, expanded.text
    assert expanded.json()['seats'][0]['id'] == seat['id']
    assert client.delete(f'/api/v1/rooms/floors/{floor["id"]}', headers=headers).status_code == 409
