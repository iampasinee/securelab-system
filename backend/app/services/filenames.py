import re

from app.core.errors import fail


PLACEHOLDERS = {'studentId', 'studentCode', 'firstName', 'lastName', 'firstNameEn', 'lastNameEn', 'uploadSequence', 'extension'}
DEFAULT_TEMPLATE = '{studentId}_{firstName}_{lastName}_{uploadSequence}.{extension}'


def validate_template(template):
    if template is None:
        return
    placeholders = re.findall(r'\{([^{}]*)\}', template)
    remainder = re.sub(r'\{[^{}]*\}', '', template)
    if set(placeholders) - PLACEHOLDERS or '{' in remainder or '}' in remainder or not re.fullmatch(r'[A-Za-z0-9_.-]*', remainder):
        fail('invalid_filename_template', 'รูปแบบชื่อไฟล์ใช้ตัวแปรที่รองรับและตัวอักษรภาษาอังกฤษ ตัวเลข ขีด หรือขีดล่างเท่านั้น', 422)


def safe_name_part(value, fallback):
    return re.sub(r'[^A-Za-z0-9_-]', '', value or '') or fallback


def generated_name(exam, profile, sequence, extension):
    template = exam['automatic_filename_template'] or DEFAULT_TEMPLATE
    validate_template(template)
    values = {'studentId': profile['student_code'], 'studentCode': profile['student_code'],
              'firstName': safe_name_part(profile['first_name_en'] or profile['first_name'], 'Student'),
              'lastName': safe_name_part(profile['last_name_en'] or profile['last_name'], 'Name'),
              'firstNameEn': safe_name_part(profile['first_name_en'], 'Student'), 'lastNameEn': safe_name_part(profile['last_name_en'], 'Name'),
              'uploadSequence': str(sequence), 'extension': extension.lstrip('.')}
    name = re.sub(r'\{([^{}]*)\}', lambda match: values[match[1]], template)
    if name.lower().endswith(extension):
        name = name[:-len(extension)]
    base = re.sub(r'[^A-Za-z0-9_-]', '_', name)[:100] or f'file_{sequence}'
    return base + extension
