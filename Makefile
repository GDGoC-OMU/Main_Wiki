.PHONY: build

build:
	docker compose run --rm antora generate path.yml
	@echo "Build complete. Check the output in the 'build' directory."