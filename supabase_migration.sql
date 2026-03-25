-- ============================================================
-- LA DESPENSA — Migración inicial completa
-- Ejecutar en: Supabase → SQL Editor → New query → Run
--
-- INSTRUCCIONES:
-- 1. Ejecuta este archivo completo primero
-- 2. Después pega y ejecuta tu bloque de INSERTs de ingredientes
--    (deben seguir el mismo formato que el ejemplo del final)
-- ============================================================

-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE hogares (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT        NOT NULL,
  codigo_union   TEXT        UNIQUE NOT NULL DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
  num_comensales INT         NOT NULL DEFAULT 2 CHECK (num_comensales >= 1),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE perfiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  hogar_id   UUID        REFERENCES hogares(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categorias_ingredientes (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL,
  icono  TEXT,
  orden  INT NOT NULL DEFAULT 0
);

CREATE TABLE subcategorias_ingredientes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  categoria_id UUID NOT NULL REFERENCES categorias_ingredientes(id) ON DELETE CASCADE,
  UNIQUE(nombre, categoria_id)
);

CREATE TABLE ingredientes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT        UNIQUE NOT NULL,
  categoria_id    UUID        REFERENCES categorias_ingredientes(id) ON DELETE SET NULL,
  subcategoria_id UUID        REFERENCES subcategorias_ingredientes(id) ON DELETE SET NULL,
  unidad_base     TEXT        NOT NULL DEFAULT 'g',
  aprobado        BOOLEAN     NOT NULL DEFAULT false,
  propuesto_por   UUID        REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recetas (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo             TEXT        NOT NULL,
  descripcion        TEXT,
  imagen_url         TEXT,
  tiempo_preparacion INT,
  tiempo_coccion     INT,
  dificultad         TEXT        CHECK (dificultad IN ('facil', 'media', 'dificil')),
  tipo_comida        TEXT        CHECK (tipo_comida IN ('desayuno', 'almuerzo', 'comida', 'merienda', 'cena')),
  comensales_base    INT         NOT NULL DEFAULT 2 CHECK (comensales_base >= 1),
  publica            BOOLEAN     NOT NULL DEFAULT true,
  hogar_id           UUID        REFERENCES hogares(id) ON DELETE CASCADE,
  autor_id           UUID        REFERENCES perfiles(id) ON DELETE SET NULL,
  likes              INT         NOT NULL DEFAULT 0,
  pasos              JSONB       NOT NULL DEFAULT '[]',
  tags               TEXT[]      NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE receta_ingredientes (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id      UUID    NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  ingrediente_id UUID    NOT NULL REFERENCES ingredientes(id) ON DELETE RESTRICT,
  cantidad       NUMERIC NOT NULL CHECK (cantidad > 0),
  unidad         TEXT    NOT NULL,
  notas          TEXT,
  UNIQUE(receta_id, ingrediente_id)
);

CREATE TABLE recetas_guardadas (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id     UUID        NOT NULL REFERENCES hogares(id) ON DELETE CASCADE,
  receta_id    UUID        NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  guardada_por UUID        REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hogar_id, receta_id)
);

CREATE TABLE recetas_likes (
  usuario_id UUID        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  receta_id  UUID        NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, receta_id)
);

CREATE TABLE planning_semanal (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id    UUID        NOT NULL REFERENCES hogares(id) ON DELETE CASCADE,
  fecha       DATE        NOT NULL,
  tipo_comida TEXT        NOT NULL CHECK (tipo_comida IN ('desayuno', 'almuerzo', 'comida', 'merienda', 'cena')),
  receta_id   UUID        REFERENCES recetas(id) ON DELETE SET NULL,
  created_by  UUID        REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hogar_id, fecha, tipo_comida)
);

CREATE TABLE lista_compra (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id       UUID        NOT NULL REFERENCES hogares(id) ON DELETE CASCADE,
  ingrediente_id UUID        REFERENCES ingredientes(id) ON DELETE CASCADE,
  nombre_libre   TEXT,
  cantidad       NUMERIC     NOT NULL CHECK (cantidad > 0),
  unidad         TEXT        NOT NULL,
  comprado       BOOLEAN     NOT NULL DEFAULT false,
  manual         BOOLEAN     NOT NULL DEFAULT false,
  notas          TEXT,
  semana_inicio  DATE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hogar_id, ingrediente_id, semana_inicio),
  CONSTRAINT tiene_nombre CHECK (ingrediente_id IS NOT NULL OR nombre_libre IS NOT NULL)
);


-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

-- Crea el perfil automáticamente al registrarse.
-- ON CONFLICT DO NOTHING evita errores si el frontend también intenta crearlo.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO perfiles (id, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Actualiza updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER recetas_updated_at
  BEFORE UPDATE ON recetas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER perfiles_updated_at
  BEFORE UPDATE ON perfiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER lista_compra_updated_at
  BEFORE UPDATE ON lista_compra
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Mantiene el contador de likes sincronizado
CREATE OR REPLACE FUNCTION sync_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE recetas SET likes = likes + 1 WHERE id = NEW.receta_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE recetas SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.receta_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON recetas_likes
  FOR EACH ROW EXECUTE FUNCTION sync_likes_count();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE hogares                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_ingredientes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategorias_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredientes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE receta_ingredientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas_guardadas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas_likes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_semanal           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_compra               ENABLE ROW LEVEL SECURITY;

-- perfiles
CREATE POLICY "perfiles_select" ON perfiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "perfiles_insert" ON perfiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "perfiles_update" ON perfiles FOR UPDATE USING (auth.uid() = id);

-- hogares: los miembros ven su hogar; cualquier auth puede buscar por código para unirse
CREATE POLICY "hogares_select"   ON hogares FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "hogares_insert"   ON hogares FOR INSERT  WITH CHECK (true);
CREATE POLICY "hogares_update"   ON hogares FOR UPDATE  USING (id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));

-- categorías y subcategorías: solo lectura para usuarios autenticados
CREATE POLICY "categorias_select"    ON categorias_ingredientes    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "subcategorias_select" ON subcategorias_ingredientes FOR SELECT USING (auth.uid() IS NOT NULL);

-- ingredientes
CREATE POLICY "ingredientes_select" ON ingredientes FOR SELECT
  USING (aprobado = true OR propuesto_por = auth.uid());
CREATE POLICY "ingredientes_insert" ON ingredientes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- recetas
CREATE POLICY "recetas_select" ON recetas FOR SELECT
  USING (publica = true OR autor_id = auth.uid() OR hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "recetas_insert" ON recetas FOR INSERT  WITH CHECK (autor_id = auth.uid());
CREATE POLICY "recetas_update" ON recetas FOR UPDATE  USING (autor_id = auth.uid());
CREATE POLICY "recetas_delete" ON recetas FOR DELETE  USING (autor_id = auth.uid());

-- receta_ingredientes
CREATE POLICY "receta_ing_select" ON receta_ingredientes FOR SELECT
  USING (receta_id IN (SELECT id FROM recetas));
CREATE POLICY "receta_ing_insert" ON receta_ingredientes FOR INSERT
  WITH CHECK (receta_id IN (SELECT id FROM recetas WHERE autor_id = auth.uid()));
CREATE POLICY "receta_ing_update" ON receta_ingredientes FOR UPDATE
  USING (receta_id IN (SELECT id FROM recetas WHERE autor_id = auth.uid()));
CREATE POLICY "receta_ing_delete" ON receta_ingredientes FOR DELETE
  USING (receta_id IN (SELECT id FROM recetas WHERE autor_id = auth.uid()));

-- recetas guardadas
CREATE POLICY "guardadas_select" ON recetas_guardadas FOR SELECT
  USING (hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "guardadas_insert" ON recetas_guardadas FOR INSERT
  WITH CHECK (hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "guardadas_delete" ON recetas_guardadas FOR DELETE
  USING (hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));

-- likes
CREATE POLICY "likes_select" ON recetas_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON recetas_likes FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "likes_delete" ON recetas_likes FOR DELETE USING (usuario_id = auth.uid());

-- planning
CREATE POLICY "planning_select" ON planning_semanal FOR SELECT
  USING (hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "planning_insert" ON planning_semanal FOR INSERT
  WITH CHECK (hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "planning_update" ON planning_semanal FOR UPDATE
  USING (hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "planning_delete" ON planning_semanal FOR DELETE
  USING (hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));

-- lista de la compra
CREATE POLICY "lista_select" ON lista_compra FOR SELECT
  USING (hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "lista_insert" ON lista_compra FOR INSERT
  WITH CHECK (hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "lista_update" ON lista_compra FOR UPDATE
  USING (hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));
CREATE POLICY "lista_delete" ON lista_compra FOR DELETE
  USING (hogar_id IN (SELECT hogar_id FROM perfiles WHERE id = auth.uid()));


-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_perfiles_hogar             ON perfiles(hogar_id);
CREATE INDEX idx_recetas_autor              ON recetas(autor_id);
CREATE INDEX idx_recetas_hogar              ON recetas(hogar_id);
CREATE INDEX idx_recetas_publica            ON recetas(publica);
CREATE INDEX idx_recetas_tipo               ON recetas(tipo_comida);
CREATE INDEX idx_receta_ing_receta          ON receta_ingredientes(receta_id);
CREATE INDEX idx_receta_ing_ingrediente     ON receta_ingredientes(ingrediente_id);
CREATE INDEX idx_planning_hogar_fecha       ON planning_semanal(hogar_id, fecha);
CREATE INDEX idx_lista_hogar                ON lista_compra(hogar_id);
CREATE INDEX idx_lista_comprado             ON lista_compra(hogar_id, comprado);
CREATE INDEX idx_guardadas_hogar            ON recetas_guardadas(hogar_id);
CREATE INDEX idx_likes_receta               ON recetas_likes(receta_id);
CREATE INDEX idx_ingredientes_nombre        ON ingredientes(nombre);
CREATE INDEX idx_ingredientes_categoria     ON ingredientes(categoria_id);
CREATE INDEX idx_ingredientes_aprobado      ON ingredientes(aprobado);


-- ============================================================
-- SEED: CATEGORÍAS
-- ============================================================

INSERT INTO categorias_ingredientes (nombre, icono, orden) VALUES
  ('Aceite, especias y salsas',     '🫒', 1),
  ('Agua, zumos y refrescos',       '🧃', 2),
  ('Aperitivos',                    '🥜', 3),
  ('Arroz, legumbres y pasta',      '🍝', 4),
  ('Azúcar, caramelos y chocolate', '🍫', 5),
  ('Bodega',                        '🍷', 6),
  ('Cacao, café e infusiones',      '☕', 7),
  ('Carne',                         '🥩', 8),
  ('Cereales y galletas',           '🍪', 9),
  ('Charcutería y quesos',          '🧀', 10),
  ('Congelados',                    '🧊', 11),
  ('Conservas, caldos y cremas',    '🥫', 12),
  ('Fruta y verdura',               '🥦', 13),
  ('Huevos, leche y mantequilla',   '🥚', 14),
  ('Marisco y pescado',             '🦐', 15),
  ('Panadería y pastelería',        '🥖', 16),
  ('Pizzas y platos preparados',    '🍕', 17),
  ('Postres y yogures',             '🍮', 18),
  ('Limpieza y Hogar',              '🧹', 19),
  ('Bebé',                          '👶', 20),
  ('Parafarmacia',                  '💊', 21),
  ('Cuidado personal',              '🧴', 22),
  ('Mascotas',                      '🐾', 23),
  ('Bazar y Papelería',             '📦', 24);


-- ============================================================
-- SEED: SUBCATEGORÍAS
-- ============================================================

INSERT INTO subcategorias_ingredientes (nombre, categoria_id) VALUES
  ('Aceites y Vinagres',      (SELECT id FROM categorias_ingredientes WHERE nombre = 'Aceite, especias y salsas')),
  ('Especias y Condimentos',  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Aceite, especias y salsas')),
  ('Salsas',                  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Aceite, especias y salsas')),
  ('Agua',                    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Agua, zumos y refrescos')),
  ('Refrescos',               (SELECT id FROM categorias_ingredientes WHERE nombre = 'Agua, zumos y refrescos')),
  ('Zumos',                   (SELECT id FROM categorias_ingredientes WHERE nombre = 'Agua, zumos y refrescos')),
  ('Encurtidos',              (SELECT id FROM categorias_ingredientes WHERE nombre = 'Aperitivos')),
  ('Frutos Secos',            (SELECT id FROM categorias_ingredientes WHERE nombre = 'Aperitivos')),
  ('Snacks',                  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Aperitivos')),
  ('Arroces y Granos',        (SELECT id FROM categorias_ingredientes WHERE nombre = 'Arroz, legumbres y pasta')),
  ('Legumbres',               (SELECT id FROM categorias_ingredientes WHERE nombre = 'Arroz, legumbres y pasta')),
  ('Pasta',                   (SELECT id FROM categorias_ingredientes WHERE nombre = 'Arroz, legumbres y pasta')),
  ('Azúcar',                  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Azúcar, caramelos y chocolate')),
  ('Chicles y caramelos',     (SELECT id FROM categorias_ingredientes WHERE nombre = 'Azúcar, caramelos y chocolate')),
  ('Chocolate',               (SELECT id FROM categorias_ingredientes WHERE nombre = 'Azúcar, caramelos y chocolate')),
  ('Golosinas',               (SELECT id FROM categorias_ingredientes WHERE nombre = 'Azúcar, caramelos y chocolate')),
  ('Mermelada y miel',        (SELECT id FROM categorias_ingredientes WHERE nombre = 'Azúcar, caramelos y chocolate')),
  ('Cervezas',                (SELECT id FROM categorias_ingredientes WHERE nombre = 'Bodega')),
  ('Licores',                 (SELECT id FROM categorias_ingredientes WHERE nombre = 'Bodega')),
  ('Vinos y Espumosos',       (SELECT id FROM categorias_ingredientes WHERE nombre = 'Bodega')),
  ('Cacao',                   (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cacao, café e infusiones')),
  ('Café',                    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cacao, café e infusiones')),
  ('Infusiones',              (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cacao, café e infusiones')),
  ('Aves',                    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Carne')),
  ('Casquería',               (SELECT id FROM categorias_ingredientes WHERE nombre = 'Carne')),
  ('Cerdo',                   (SELECT id FROM categorias_ingredientes WHERE nombre = 'Carne')),
  ('Conejo y Cordero',        (SELECT id FROM categorias_ingredientes WHERE nombre = 'Carne')),
  ('Embutidos y Preparados',  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Carne')),
  ('Vacuno',                  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Carne')),
  ('Cereales',                (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cereales y galletas')),
  ('Galletas',                (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cereales y galletas')),
  ('Aves y jamón cocido',     (SELECT id FROM categorias_ingredientes WHERE nombre = 'Charcutería y quesos')),
  ('Bacon y salchichas',      (SELECT id FROM categorias_ingredientes WHERE nombre = 'Charcutería y quesos')),
  ('Choped y mortadela',      (SELECT id FROM categorias_ingredientes WHERE nombre = 'Charcutería y quesos')),
  ('Embutido curado',         (SELECT id FROM categorias_ingredientes WHERE nombre = 'Charcutería y quesos')),
  ('Jamón serrano',           (SELECT id FROM categorias_ingredientes WHERE nombre = 'Charcutería y quesos')),
  ('Paté y sobrasada',        (SELECT id FROM categorias_ingredientes WHERE nombre = 'Charcutería y quesos')),
  ('Quesos',                  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Charcutería y quesos')),
  ('Carne y Precocinados',    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Congelados')),
  ('Otros Congelados',        (SELECT id FROM categorias_ingredientes WHERE nombre = 'Congelados')),
  ('Pescado y Marisco Cong',  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Congelados')),
  ('Verduras y Guarniciones', (SELECT id FROM categorias_ingredientes WHERE nombre = 'Congelados')),
  ('Caldos',                  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Conservas, caldos y cremas')),
  ('Conservas de Pescado',    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Conservas, caldos y cremas')),
  ('Cremas',                  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Conservas, caldos y cremas')),
  ('Frutas',                  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Fruta y verdura')),
  ('Hierbas y Aromáticas',    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Fruta y verdura')),
  ('Hortalizas y Verduras',   (SELECT id FROM categorias_ingredientes WHERE nombre = 'Fruta y verdura')),
  ('Setas y Hongos',          (SELECT id FROM categorias_ingredientes WHERE nombre = 'Fruta y verdura')),
  ('Tubérculos y Raíces',     (SELECT id FROM categorias_ingredientes WHERE nombre = 'Fruta y verdura')),
  ('Huevos',                  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Huevos, leche y mantequilla')),
  ('Leche y Bebidas Lácteas', (SELECT id FROM categorias_ingredientes WHERE nombre = 'Huevos, leche y mantequilla')),
  ('Nata y Mantequilla',      (SELECT id FROM categorias_ingredientes WHERE nombre = 'Huevos, leche y mantequilla')),
  ('Conservas y Ahumados',    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Marisco y pescado')),
  ('Marisco y Cefalópodos',   (SELECT id FROM categorias_ingredientes WHERE nombre = 'Marisco y pescado')),
  ('Pescado Fresco',          (SELECT id FROM categorias_ingredientes WHERE nombre = 'Marisco y pescado')),
  ('Harinas, masas y levaduras', (SELECT id FROM categorias_ingredientes WHERE nombre = 'Panadería y pastelería')),
  ('Otros Panadería',         (SELECT id FROM categorias_ingredientes WHERE nombre = 'Panadería y pastelería')),
  ('Pizzas',                  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Pizzas y platos preparados')),
  ('Platos Preparados',       (SELECT id FROM categorias_ingredientes WHERE nombre = 'Pizzas y platos preparados')),
  ('Postres',                 (SELECT id FROM categorias_ingredientes WHERE nombre = 'Postres y yogures')),
  ('Yogures',                 (SELECT id FROM categorias_ingredientes WHERE nombre = 'Postres y yogures')),
  ('Detergente y suavizante ropa',       (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Estropajo, bayeta y guantes',        (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Insecticida y ambientador',          (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Lejía y líquidos fuertes',           (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Limpiacristales',                    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Limpiahogar y fregasuelos',          (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Limpieza baño y WC',                 (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Limpieza cocina',                    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Limpieza muebles y multiusos',       (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Limpieza vajilla',                   (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Menaje y conservación alimentos',    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Papel higiénico y celulosa',         (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Pilas y bolsas de basura',           (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Utensilios de limpieza y calzado',   (SELECT id FROM categorias_ingredientes WHERE nombre = 'Limpieza y Hogar')),
  ('Accesorios Bebé',         (SELECT id FROM categorias_ingredientes WHERE nombre = 'Bebé')),
  ('Alimentación Bebé',       (SELECT id FROM categorias_ingredientes WHERE nombre = 'Bebé')),
  ('Higiene Bebé',            (SELECT id FROM categorias_ingredientes WHERE nombre = 'Bebé')),
  ('Botiquín',                (SELECT id FROM categorias_ingredientes WHERE nombre = 'Parafarmacia')),
  ('Salud',                   (SELECT id FROM categorias_ingredientes WHERE nombre = 'Parafarmacia')),
  ('Salud Sexual',            (SELECT id FROM categorias_ingredientes WHERE nombre = 'Parafarmacia')),
  ('Acondicionador y mascarilla',     (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Afeitado y cuidado hombre',       (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Cabello',                         (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Champú',                          (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Coloración cabello',              (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Cuidado corporal',                (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Cuidado e higiene facial',        (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Depilación',                      (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Desodorante',                     (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Fijación cabello',                (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Gel y jabón de manos',            (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Higiene bucal',                   (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Higiene corporal',                (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Higiene íntima',                  (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Manicura y pedicura',             (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Perfume y colonia',               (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Protector solar y aftersun',      (SELECT id FROM categorias_ingredientes WHERE nombre = 'Cuidado personal')),
  ('Gato',                    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Mascotas')),
  ('Otras Mascotas',          (SELECT id FROM categorias_ingredientes WHERE nombre = 'Mascotas')),
  ('Perro',                   (SELECT id FROM categorias_ingredientes WHERE nombre = 'Mascotas')),
  ('Electricidad y Hogar',    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Bazar y Papelería')),
  ('Hogar Bazar',             (SELECT id FROM categorias_ingredientes WHERE nombre = 'Bazar y Papelería')),
  ('Jardín y Exterior',       (SELECT id FROM categorias_ingredientes WHERE nombre = 'Bazar y Papelería')),
  ('Papelería',               (SELECT id FROM categorias_ingredientes WHERE nombre = 'Bazar y Papelería'));


-- ============================================================
-- SEED: INGREDIENTES
-- ============================================================
-- Pega aquí tu bloque completo de INSERTs de ingredientes.
-- Formato esperado:
--
-- INSERT INTO ingredientes (nombre, categoria_id, subcategoria_id, unidad_base, aprobado) VALUES
--   ('Aceite de oliva virgen extra',
--    (SELECT id FROM categorias_ingredientes WHERE nombre = 'Aceite, especias y salsas'),
--    (SELECT id FROM subcategorias_ingredientes
--      WHERE nombre = 'Aceites y Vinagres'
--      AND categoria_id = (SELECT id FROM categorias_ingredientes WHERE nombre = 'Aceite, especias y salsas')),
--    'ml', true),
--   ('Siguiente ingrediente', ...),
--   ('Último ingrediente', ..., true);   ← termina en punto y coma
-- ============================================================
