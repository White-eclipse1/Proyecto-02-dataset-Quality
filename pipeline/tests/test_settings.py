from dataset_quality.config.settings import Settings


def test_settings_load_from_env(monkeypatch):
    monkeypatch.setenv("DB_HOST", "test-db")
    monkeypatch.setenv("OBJECT_STORE_BUCKET", "test-bucket")

    settings = Settings(_env_file=None)

    assert settings.db_host == "test-db"
    assert settings.object_store_bucket == "test-bucket"
    assert settings.database_url.startswith("mysql+pymysql://")
