use serde_json::Value;

pub type MigrationFn = fn(Value) -> Value;

/// Ordered list of schema migrations:
/// MIGRATIONS[0] upgrades version 1 -> 2, etc.
pub const MIGRATIONS: &[MigrationFn] = &[];

/// Applies all pending migrations up to the target version.
pub fn migrate(mut val: Value) -> Result<Value, String> {
    let current_version = val.get("version").and_then(Value::as_u64).unwrap_or(1) as usize;

    let target_version = MIGRATIONS.len() + 1;

    for (idx, migration) in MIGRATIONS.iter().enumerate().skip(current_version - 1) {
        val = migration(val);
        if let Some(obj) = val.as_object_mut() {
            obj.insert(
                "version".to_string(),
                serde_json::Value::Number((idx + 2).into()),
            );
        }
    }

    if let Some(obj) = val.as_object_mut() {
        obj.insert(
            "version".to_string(),
            serde_json::Value::Number(target_version.into()),
        );
    }

    Ok(val)
}
