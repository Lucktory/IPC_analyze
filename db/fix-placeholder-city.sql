-- ============================================================================
-- Clear the bulk-import placeholder location on properties.
--
-- Every one of the 123 properties was imported with city='CABA' +
-- province='Buenos Aires' -- a geographically impossible pair (CABA is the
-- Ciudad Autonoma de Buenos Aires, NOT part of Buenos Aires province). The real
-- localities were never captured, so this nulls the placeholder rather than
-- assert a wrong location on every page. Re-enter real cities when available.
--
-- The app already hides this placeholder at the query layer (lib/geo.ts), so
-- running this is OPTIONAL -- it just removes the bad value at the source.
-- ============================================================================

-- Preview what will change (run this first):
-- SELECT city, province, count(*) FROM properties GROUP BY city, province;

UPDATE properties
SET city = NULL, province = NULL
WHERE upper(trim(city)) = 'CABA'
  AND upper(trim(coalesce(province, ''))) = 'BUENOS AIRES';

-- Verify (expect 0 rows still on the placeholder):
-- SELECT count(*) FROM properties WHERE upper(trim(city)) = 'CABA';
