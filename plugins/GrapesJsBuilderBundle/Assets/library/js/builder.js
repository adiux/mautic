import AssetService from './asset.service';
import BuilderService from './builder.service';
// import grapesjsmautic from 'grapesjs-preset-mautic/src/content.service';

// all css get combined into one builder.css and automatically loaded via js/parcel
import 'grapesjs/dist/css/grapes.min.css';
// not compatible with the newsletter preset css, brings the redish color
// import 'grapesjs-preset-webpage/dist/grapesjs-preset-webpage.min.css';
import 'grapesjs-preset-newsletter/dist/grapesjs-preset-newsletter.css';
import './grapesjs-custom.css';
import ContentService from 'grapesjs-preset-mautic/dist/content.service';
import MjmlService from 'grapesjs-preset-mautic/dist/mjml/mjml.service';

/**
 * Launch builder
 *
 * @param formName
 * @param actionName
 */
function launchBuilderGrapesjs(formName) {
  const assets = AssetService.getAssets();
  const builderService = new BuilderService(assets); 

  // Prepare HTML
  mQuery('html').css('font-size', '100%');
  mQuery('body').css('overflow-y', 'hidden');
  mQuery('.builder-panel').css('padding', 0);
  mQuery('.builder-panel').css('display', 'block');
  mQuery('.builder').addClass('builder-active').removeClass('hide');

  // disable mautic global shortcuts
  Mousetrap.reset();

  // if there is an existing builder, use it (e.g. for history)
  if (Mautic && Mautic.builder) {
    builderService.setEditor(Mautic.builder);
  }

  // Initialize GrapesJS and make it available in the Mautic scope
  // so it can be accessed by 3rd party plugins as requested
  // by the community. Should not be used from the Mautic project.
  builderService.initGrapesJS(formName);
  // Mautic.builder = builderService.initGrapesJS(formName);

  // const contentService = new ContentService();
  // const isMjmlMode = ContentService.isMjmlMode(Mautic.builder);
  // const components = getComponents(isMjmlMode);
  // Mautic.builder.setComponents(components);
  
  Mautic.showChangeThemeWarning = true;
}

function getComponents(isMjmlMode) {
  let components = '';

  if (isMjmlMode) {
    components = MjmlService.getOriginalContentMjml();
    // validate
    MjmlService.mjmlToHtml(components);
  } else {
    //html page and email html
    components = ContentService.getOriginalContentHtml().body.innerHTML;
  }
  if (components.length <= 0) {
    throw new Error('No components found');
  }
  return components;
}

/**
 * Set theme's HTML
 *
 * @param theme
 */
function setThemeHtml(theme) {
  BuilderService.setupButtonLoadingIndicator(true);
  // Load template and fill field
  mQuery.ajax({
    url: mQuery('#builder_url').val(),
    data: `template=${theme}`,
    dataType: 'json',
    success(response) {
      const textareaHtml = mQuery('textarea.builder-html');
      const textareaMjml = mQuery('textarea.builder-mjml');

      textareaHtml.val(response.templateHtml);

      if (typeof textareaMjml !== 'undefined') {
        textareaMjml.val(response.templateMjml);
      }

      // If MJML template, generate HTML before save
      // if (!textareaHtml.val().length && textareaMjml.val().length) {
      //   builder.mjmlToHtml(textareaMjml, textareaHtml);
      // }
      // }
    },
    error(request, textStatus) {
      console.log(`setThemeHtml - Request failed: ${textStatus}`);
    },
    complete() {
      BuilderService.setupButtonLoadingIndicator(false);
    },
  });
}

/**
 * The builder button to launch GrapesJS will be disabled when the code mode theme is selected
 *
 * @param theme
 */
function switchBuilderButton(theme) {
  const builderButton  = mQuery('.btn-builder');
  const mEmailBuilderButton = mQuery('#emailform_buttons_builder_toolbar_mobile');
  const mPageBuilderButton = mQuery('#page_buttons_builder_toolbar_mobile');
  const isCodeMode = theme === 'mautic_code_mode';

  builderButton.attr('disabled', isCodeMode);

  if (isCodeMode) {
    mPageBuilderButton.addClass('link-is-disabled');
    mEmailBuilderButton.addClass('link-is-disabled');

    mPageBuilderButton.parent().addClass('is-not-allowed');
    mEmailBuilderButton.parent().addClass('is-not-allowed');
  } else {
    mPageBuilderButton.removeClass('link-is-disabled');
    mEmailBuilderButton.removeClass('link-is-disabled');

    mPageBuilderButton.parent().removeClass('is-not-allowed');
    mEmailBuilderButton.parent().removeClass('is-not-allowed');
  }
}

/**
 * The textarea with the HTML source will be displayed if the code mode theme is selected
 *
 * @param theme
 */
function switchCustomHtml(theme) {
  const customHtmlRow = mQuery('#custom-html-row');
  const isPageMode = mQuery('[name="page"]').length !== 0;
  const isCodeMode = theme === 'mautic_code_mode';
  const advancedTab = isPageMode ? mQuery('#advanced-tab') : null;

  if (isCodeMode === true) {
    customHtmlRow.removeClass('hidden');
    isPageMode && advancedTab.removeClass('hidden');
  } else {
    customHtmlRow.addClass('hidden');
    isPageMode && advancedTab.addClass('hidden');
  }
}

/**
 * Initialize original Mautic theme selection with grapejs specific modifications
 */
function initSelectThemeGrapesjs(parentInitSelectTheme) {
  function childInitSelectTheme(themeField) {
    const builderUrl = mQuery('#builder_url');
    let url;

    switchBuilderButton(themeField.val());
    switchCustomHtml(themeField.val());

    // Replace Mautic URL by plugin URL
    if (builderUrl.length) {
      if (builderUrl.val().indexOf('pages') !== -1) {
        url = builderUrl.val().replace('s/pages/builder', 's/grapesjsbuilder/page');
      } else {
        url = builderUrl.val().replace('s/emails/builder', 's/grapesjsbuilder/email');
      }

      builderUrl.val(url);
    }

    // Launch original Mautic.initSelectTheme function
    parentInitSelectTheme(themeField);

    mQuery('[data-theme]').click((event) => {
      const theme = mQuery(event.target).attr('data-theme');

      switchBuilderButton(theme);
      switchCustomHtml(theme);
    });
  }
  return childInitSelectTheme;
}

Mautic.launchBuilder = launchBuilderGrapesjs;
Mautic.initSelectTheme = initSelectThemeGrapesjs(Mautic.initSelectTheme);
Mautic.setThemeHtml = setThemeHtml;
