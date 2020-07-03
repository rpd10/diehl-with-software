module.exports = {
  name: 'blog-data',
  preset: '../../jest.config.js',
  coverageDirectory: '../../coverage/libs/blog-data',
  snapshotSerializers: [
    'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js',
    'jest-preset-angular/build/AngularSnapshotSerializer.js',
    'jest-preset-angular/build/HTMLCommentSerializer.js',
  ],
};
