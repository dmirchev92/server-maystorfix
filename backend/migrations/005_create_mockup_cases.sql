-- Create 20 mockup cases for testing trial system
-- These are open cases that Service Providers can accept

INSERT INTO marketplace_service_cases (
  id, service_type, description, preferred_date, preferred_time,
  priority, city, neighborhood, phone, additional_details,
  is_open_case, assignment_type, status, category,
  created_at, updated_at
) VALUES
-- Case 1
('test-case-001', 'Електротехник', 'Нужна е подмяна на електрически табло в апартамент', '2025-11-05', 'morning', 'urgent', 'София', 'Люлин', '+359888111001', 'Старо табло, нужна спешна подмяна', TRUE, 'open', 'pending', 'electrical', NOW(), NOW()),

-- Case 2
('test-case-002', 'Водопроводчик', 'Теч на тръба в банята', '2025-11-06', 'afternoon', 'urgent', 'София', 'Младост', '+359888111002', 'Водата тече от тръбата под мивката', TRUE, 'open', 'pending', 'plumbing', NOW(), NOW()),

-- Case 3
('test-case-003', 'Климатик', 'Монтаж на нов климатик в хол', '2025-11-07', 'morning', 'normal', 'София', 'Център', '+359888111003', 'Имам закупен климатик, нужен монтаж', TRUE, 'open', 'pending', 'hvac', NOW(), NOW()),

-- Case 4
('test-case-004', 'Строител', 'Ремонт на баня - плочки и боядисване', '2025-11-08', 'flexible', 'normal', 'София', 'Надежда', '+359888111004', 'Баня 4 кв.м, нужен цялостен ремонт', TRUE, 'open', 'pending', 'construction', NOW(), NOW()),

-- Case 5
('test-case-005', 'Мебелист', 'Сглобяване на гардероб ИКЕА', '2025-11-09', 'afternoon', 'low', 'София', 'Витоша', '+359888111005', 'Гардероб 3 врати, имам всички части', TRUE, 'open', 'pending', 'furniture', NOW(), NOW()),

-- Case 6
('test-case-006', 'Боядисване', 'Боядисване на 2 стаи', '2025-11-10', 'morning', 'normal', 'София', 'Овча купел', '+359888111006', 'Около 40 кв.м общо', TRUE, 'open', 'pending', 'painting', NOW(), NOW()),

-- Case 7
('test-case-007', 'Почистване', 'Основно почистване след ремонт', '2025-11-11', 'afternoon', 'urgent', 'София', 'Дружба', '+359888111007', 'Апартамент 80 кв.м след ремонт', TRUE, 'open', 'pending', 'cleaning', NOW(), NOW()),

-- Case 8
('test-case-008', 'Електротехник', 'Инсталация на осветление в кухня', '2025-11-12', 'morning', 'normal', 'София', 'Красно село', '+359888111008', 'LED ленти и спотове', TRUE, 'open', 'pending', 'electrical', NOW(), NOW()),

-- Case 9
('test-case-009', 'Водопроводчик', 'Смяна на бойлер', '2025-11-13', 'flexible', 'normal', 'София', 'Банишора', '+359888111009', 'Стар бойлер 80л, нужна подмяна', TRUE, 'open', 'pending', 'plumbing', NOW(), NOW()),

-- Case 10
('test-case-010', 'Климатик', 'Профилактика на климатик', '2025-11-14', 'afternoon', 'low', 'София', 'Изток', '+359888111010', 'Годишна профилактика, 2 климатика', TRUE, 'open', 'pending', 'hvac', NOW(), NOW()),

-- Case 11
('test-case-011', 'Строител', 'Изграждане на преградна стена', '2025-11-15', 'morning', 'normal', 'София', 'Хладилника', '+359888111011', 'Гипсокартон стена 4 метра', TRUE, 'open', 'pending', 'construction', NOW(), NOW()),

-- Case 12
('test-case-012', 'Мебелист', 'Ремонт на кухненски шкафове', '2025-11-16', 'afternoon', 'low', 'София', 'Студентски град', '+359888111012', 'Счупени панти на 3 вратички', TRUE, 'open', 'pending', 'furniture', NOW(), NOW()),

-- Case 13
('test-case-013', 'Боядисване', 'Боядисване на таван', '2025-11-17', 'morning', 'low', 'София', 'Борово', '+359888111013', 'Само таван в хол, около 20 кв.м', TRUE, 'open', 'pending', 'painting', NOW(), NOW()),

-- Case 14
('test-case-014', 'Електротехник', 'Ремонт на ел. инсталация', '2025-11-18', 'flexible', 'urgent', 'София', 'Гео Милев', '+359888111014', 'Често изгарят предпазители', TRUE, 'open', 'pending', 'electrical', NOW(), NOW()),

-- Case 15
('test-case-015', 'Водопроводчик', 'Отпушване на канализация', '2025-11-19', 'morning', 'urgent', 'София', 'Красна поляна', '+359888111015', 'Запушена канализация в кухня', TRUE, 'open', 'pending', 'plumbing', NOW(), NOW()),

-- Case 16
('test-case-016', 'Климатик', 'Демонтаж и монтаж на климатик', '2025-11-20', 'afternoon', 'normal', 'София', 'Лозенец', '+359888111016', 'Преместване на климатик в друга стая', TRUE, 'open', 'pending', 'hvac', NOW(), NOW()),

-- Case 17
('test-case-017', 'Строител', 'Полагане на ламинат', '2025-11-21', 'morning', 'normal', 'София', 'Манастирски ливади', '+359888111017', '2 стаи, около 35 кв.м', TRUE, 'open', 'pending', 'construction', NOW(), NOW()),

-- Case 18
('test-case-018', 'Мебелист', 'Изработка на рафтове по поръчка', '2025-11-22', 'flexible', 'low', 'София', 'Слатина', '+359888111018', 'Рафтове за книги 3 метра', TRUE, 'open', 'pending', 'furniture', NOW(), NOW()),

-- Case 19
('test-case-019', 'Почистване', 'Дълбоко почистване на апартамент', '2025-11-23', 'morning', 'normal', 'София', 'Илинден', '+359888111019', 'Цялостно почистване 60 кв.м', TRUE, 'open', 'pending', 'cleaning', NOW(), NOW()),

-- Case 20
('test-case-020', 'Електротехник', 'Монтаж на домофон', '2025-11-24', 'afternoon', 'low', 'София', 'Връбница', '+359888111020', 'Нов домофон с видео', TRUE, 'open', 'pending', 'electrical', NOW(), NOW());

-- Verify the insert
SELECT COUNT(*) as total_mockup_cases FROM marketplace_service_cases WHERE id LIKE 'test-case-%';
