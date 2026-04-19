function publicSettingsPayload(settings) {
    return {
      rsvpOpenGlobal: settings.rsvpOpenGlobal !== false,
      photos: settings.photos || {},
      party: settings.party || [],
      siteContent: settings.siteContent && typeof settings.siteContent === 'object' ? settings.siteContent : {},
    };
  }

  function heroPayload(settings) {
    const sc = settings.siteContent && typeof settings.siteContent === 'object' ? settings.siteContent : {};
    return {
      rsvpOpenGlobal: settings.rsvpOpenGlobal !== false,
      hero: sc.hero && typeof sc.hero === 'object' ? sc.hero : {},
      heroPhoto: (settings.photos && settings.photos.hero) || null,
    };
  }

  module.exports = { publicSettingsPayload, heroPayload };
