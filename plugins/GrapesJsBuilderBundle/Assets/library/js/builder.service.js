import grapesjs from 'grapesjs';
import grapesjsmjml from 'grapesjs-mjml';
import grapesjsnewsletter from 'grapesjs-preset-newsletter';
import grapesjswebpage from 'grapesjs-preset-webpage';
import grapesjspostcss from 'grapesjs-parser-postcss';
import contentService from 'grapesjs-preset-mautic/src/content.service';
import grapesjsmautic from 'grapesjs-preset-mautic';
import mjmlService from 'grapesjs-preset-mautic/src/mjml/mjml.service';
import 'grapesjs-plugin-ckeditor';

// for local dev
// import contentService from '../../../../../../grapesjs-preset-mautic/src/content.service';
// import grapesjsmautic from '../../../../../../grapesjs-preset-mautic/src';
// import mjmlService from '../../../../../../grapesjs-preset-mautic/src/mjml/mjml.service';

import CodeModeButton from './codeMode/codeMode.button';
import ContentService from 'grapesjs-preset-mautic/dist/content.service';
import Logger from 'grapesjs-preset-mautic/dist/logger';


export default class BuilderService {
  static CONTAINER_CLASS = 'builder-panel';
  static GJS_EDITOR_CLASS = 'gjs-editor';

  #editor;

  #assets;

  #uploadPath;

  #deletePath;

  /**
   * @param {Editor} editor GrapesJS Editor
   * @param {Object} assetsConf GrapesJS Asset Config Object
   */
  constructor(assetsConf) {
    if (!assetsConf.conf || !assetsConf.conf.uploadPath) {
      throw Error('No uploadPath found');
    }
    if (!assetsConf.conf.deletePath) {
      throw Error('No deletePath found');
    }
    if (!assetsConf.files || !assetsConf.files[0]) {
      console.debug('No assets found');
    }
    this.setAssets(assetsConf.files);
    this.setUploadPath(assetsConf.conf.uploadPath);
    this.setDeletePath(assetsConf.conf.deletePath);
  }

  /**
   * Initialize GrapesJsBuilder
   *
   * @param object
   */
  setListeners() {
    if (!this.getEditor()) {
      throw Error('No editor found');
    }
    const editor = this.getEditor();

    const keymaps = editor.Keymaps;
    let allKeymaps;

    editor.on('modal:open', () => {
      // Save all keyboard shortcuts
      allKeymaps = { ...keymaps.getAll() };

      // Remove keyboard shortcuts to prevent launch behind popup
      keymaps.removeAll();
    });

    editor.on('modal:close', () => {
      // ReMap keyboard shortcuts on modal close
      Object.keys(allKeymaps).map((objectKey) => {
        const shortcut = allKeymaps[objectKey];

        keymaps.add(shortcut.id, shortcut.keys, shortcut.handler);
        return keymaps;
      });
    });

    editor.on('asset:remove', (response) => {
      // Delete file on server
      mQuery.ajax({
        url: this.deletePath,
        data: { filename: response.getFilename() },
      });
    });
  }

  /**
   * Initialize the grapesjs build in the
   * correct mode
   * @returns GrapesJsBuilder
   */
  initGrapesJS(type) {
    // is there an existing editor in the correct mode?
    if (this.isValidEditor(type)) {
      this.logger = new Logger(this.getEditor());
      this.logger.debug('Using the existing editor', { mode: ContentService.getMode(this.getEditor()) })
      return this.getEditor();
    }

    let editor;

    // initialize the editor in the correct mode
    if (ContentService.modePageHtml === BuilderService.getRequestedMode(type)) {
      editor = this.initPage();
    } else if (ContentService.modeEmailMjml === BuilderService.getRequestedMode(type)) {
      editor = this.initEmailMjml();
    } else if (ContentService.modeEmailHtml === BuilderService.getRequestedMode(type)) {
      editor = this.initEmailHtml();
    }
    this.setEditor(editor);
    this.addCodeModeButton();

    this.setListeners();

    return this.getEditor();
  }

  /**
   * It is not enough to check the editor parameter.
   * Mautic can remove the editor from the dome e.g. on save
   * We need to check for the necessary html compoents to be present.
   */
  isValidEditor(type) {
    return this.getEditor() &&
      document.getElementsByClassName(BuilderService.GJS_EDITOR_CLASS).length > 0 &&
      BuilderService.getRequestedMode(type) === ContentService.getMode(this.getEditor())
  }

  /**
   * Check if the editor needs to be in MJML mode
   * @returns boolean
   */
  static isMjmlModeRequested() {
    return mjmlService.getOriginalContentMjml().length > 0;
  }
  static getRequestedMode(type) {
    if (type === 'page') {
      return ContentService.modePageHtml;
    } else if (type === 'emailform') {
      if (BuilderService.isMjmlModeRequested()) {
        return ContentService.modeEmailMjml;
      } else {
        return ContentService.modeEmailHtml;
      }
    } else {
      throw Error(`Not supported builder type: ${type}`);
    }
  }

  static getMauticConf(mode) {
    return {
      mode,
    };
  }

  /**
   * Add the code mode button
   * @todo: only show button if configured: sourceEdit: 1,
   */
  addCodeModeButton() {
    const codeModeButton = new CodeModeButton(this.getEditor());
    codeModeButton.addCommand();
    codeModeButton.addButton();
  }


  static getCkeConf() {
    return {
      options: {
        language: 'en',
        toolbar: [
          { name: 'links', items: ['Link', 'Unlink'] },
          { name: 'basicstyles', items: ['Bold', 'Italic', 'Strike', '-', 'RemoveFormat'] },
          { name: 'paragraph', items: ['NumberedList', 'BulletedList', '-'] },
          { name: 'colors', items: ['TextColor', 'BGColor'] },
          { name: 'document', items: ['Source'] },
          { name: 'insert', items: ['SpecialChar'] },
        ],
        extraPlugins: ['sharedspace', 'colorbutton'],
      },
    };
  }

  /**
   * Initialize the builder in the landingapge mode
   */
  initPage() {
    // Launch GrapesJS with body part
    return grapesjs.init({
      clearOnRender: true,
      container: `.${BuilderService.CONTAINER_CLASS}`,
      height: '100%',
      canvas: {
        styles: contentService.getStyles(),
      },
      storageManager: false, // https://grapesjs.com/docs/modules/Storage.html#basic-configuration
      assetManager: this.getAssetManagerConf(),
      styleManager: {
        clearProperties: true, // Temp fix https://github.com/artf/grapesjs-preset-webpage/issues/27
      },
      plugins: [grapesjswebpage, grapesjspostcss, grapesjsmautic, 'gjs-plugin-ckeditor'],
      pluginsOpts: {
        [grapesjswebpage]: {
          formsOpts: false,
        },
        grapesjsmautic: BuilderService.getMauticConf('page-html'),
        'gjs-plugin-ckeditor': BuilderService.getCkeConf(),
      },
    });
  }

  initEmailMjml() {

    const editor = grapesjs.init({
      clearOnRender: true,
      container: `.${BuilderService.CONTAINER_CLASS}`,
      height: '100%',
      storageManager: false,
      assetManager: this.getAssetManagerConf(),
      plugins: [grapesjsmjml, grapesjspostcss, grapesjsmautic, 'gjs-plugin-ckeditor'],
      pluginsOpts: {
        grapesjsmjml: {},
        grapesjsmautic: BuilderService.getMauticConf('email-mjml'),
        'gjs-plugin-ckeditor': BuilderService.getCkeConf(),
      },
    });

    editor.BlockManager.get('mj-button').set({
      content: '<mj-button href="https://">Button</mj-button>',
    });

    return editor;
  }

  initEmailHtml() {

    // Launch GrapesJS with body part
    const editor = grapesjs.init({
      clearOnRender: true,
      container: `.${BuilderService.CONTAINER_CLASS}`,
      height: '100%',
      storageManager: false,
      assetManager: this.getAssetManagerConf(),
      plugins: [grapesjsnewsletter, grapesjspostcss, grapesjsmautic, 'gjs-plugin-ckeditor'],
      pluginsOpts: {
        grapesjsnewsletter: {},
        grapesjsmautic: BuilderService.getMauticConf('email-html'),
        'gjs-plugin-ckeditor': BuilderService.getCkeConf(),
      },
    });

    // add a Mautic custom block Button
    editor.BlockManager.get('button').set({
      content:
        '<a href="#" target="_blank" style="display:inline-block;text-decoration:none;border-color:#4e5d9d;border-width: 10px 20px;border-style:solid; text-decoration: none; -webkit-border-radius: 3px; -moz-border-radius: 3px; border-radius: 3px; background-color: #4e5d9d; display: inline-block;font-size: 16px; color: #ffffff; ">\n' +
        'Button\n' +
        '</a>',
    });

    return editor;
  }

  /**
   * Manage button loading indicator
   *
   * @param activate - true or false
   */
  static setupButtonLoadingIndicator(activate) {
    const builderButton = mQuery('.btn-builder');
    const saveButton = mQuery('.btn-save');
    const applyButton = mQuery('.btn-apply');

    if (activate) {
      Mautic.activateButtonLoadingIndicator(builderButton);
      Mautic.activateButtonLoadingIndicator(saveButton);
      Mautic.activateButtonLoadingIndicator(applyButton);
    } else {
      Mautic.removeButtonLoadingIndicator(builderButton);
      Mautic.removeButtonLoadingIndicator(saveButton);
      Mautic.removeButtonLoadingIndicator(applyButton);
    }
  }

  /**
   * Configure the Asset Manager for all modes
   * @link https://grapesjs.com/docs/modules/Assets.html#configuration
   */
  getAssetManagerConf() {
    return {
      assets: this.getAssets(),
      noAssets: Mautic.translate('grapesjsbuilder.assetManager.noAssets'),
      upload: this.getUploadPath(),
      uploadName: 'files',
      multiUpload: 1,
      embedAsBase64: false,
      openAssetsOnDrop: 1,
      autoAdd: 1,
      headers: { 'X-CSRF-Token': mauticAjaxCsrf }, // global variable
    };
  }

  getEditor() {
    return this.#editor;
  }
  setEditor(editor) {
    if (!editor) {
      throw new Error('no editor');
    }
    this.#editor = editor;
  }
  getAssets() {
    return this.#assets;
  }
  setAssets(assets) {
    this.#assets = assets;
  }
  getUploadPath() {
    return this.#uploadPath;
  }
  setUploadPath(uploadPath) {
    this.#uploadPath = uploadPath;
  }
  getDeletePath() {
    return this.#deletePath;
  }
  setDeletePath(deletePath) {
    this.#deletePath = deletePath;
  }
}
