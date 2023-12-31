# Change Log

## [0.1.0] - 2023-11-07

- Fix issue that was showing codelens on the wrong places;

## [0.0.6] - 2023-11-02

- Update README documentation;
- Remove img/*.gif from the extension package;

## [0.0.5] - 2023-11-02

- Add codelens to show the goto references on the dependsOn;
- Add reference provider to labels;
- Add diagnostic for the labels used on dependsOn that are not defined;

## [0.0.4] - 2023-10-31

### Added

- Add completion for `dependsOn` in `tasks.json` file;
- Add completion for `preLaunchTask` in `launch.json` file;

### Fixed

- Issue that prevented the default `tasks.json` and `launch.json` from workspace to provide go to definition if the `tasksLabel.includeFiles` are not set;

## [0.0.3] - 2023-10-05

### Added

- Support to add `include` files to the settings;

## [0.0.2] - 2023-06-28

### Added

- Support to go to definition from `launch.json` to `tasks.json` when ctrl+clicking from the preLaunchTask

## [0.0.1] - 2023-06-23

### Added

- Initial release
