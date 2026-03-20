(function (global) {
    const DEFAULT_SITE_CONTENT = {
      hero: {
        kicker: "We're getting married",
        names: 'Bride & Groom',
        dateLine: 'Day, Month DD, YYYY · Location, State',
        blurb:
          "We can't wait to celebrate with you. Please join us for a weekend of love, laughter, and great wine.",
        ctaRsvp: 'RSVP',
        ctaStory: 'How We Met',
      },
      howWeMet: {
        eyebrow: 'How We Met',
        title: 'From first hello to forever',
        paragraphs: [
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris fermentum, nibh at tempus posuere, arcu risus facilisis lorem, at auctor dolor lorem non arcu.',
          'Suspendisse potenti. Integer vitae justo vel nisl dignissim bibendum nec eget lorem, vitae convallis mi urna at nibh.',
        ],
      },
      schedule: {
        eyebrow: 'Schedule',
        title: 'Day of timeline',
        items: [
          {
            time: '3:00 PM',
            title: 'Guests arrive',
            detail: 'Please arrive and find your seat before the ceremony begins.',
          },
          {
            time: '3:30 PM',
            title: 'Ceremony',
            detail: 'We say "I do."',
          },
          {
            time: '4:30 PM',
            title: 'Cocktail hour',
            detail: 'Drinks and mingling.',
          },
          {
            time: '6:00 PM',
            title: 'Dinner & dancing',
            detail: 'Celebrate with us into the night.',
          },
        ],
      },
      travel: {
        eyebrow: 'Travel & Stay',
        title: 'Getting there',
        columns: [
          [
            {
              heading: 'Venue',
              paragraphs: [
                'Location, State',
                'Address and directions will be provided on your invitation.',
              ],
            },
            {
              heading: 'Parking',
              paragraphs: [
                'Parking is available in the field adjacent to the driveway. Please follow the signs to the parking area.',
              ],
            },
          ],
          [
            {
              heading: 'Where to stay',
              paragraphs: [
                'We recommend booking accommodations in Location or nearby. Block details coming soon.',
              ],
            },
            {
              heading: 'Airports',
              paragraphs: [
                'Nearest airport is the nearest airport, about X minutes from Location.',
              ],
            },
          ],
        ],
      },
      qa: {
        eyebrow: 'Q & A',
        title: 'Details & logistics',
        items: [
          {
            question: 'What time should I arrive?',
            answer:
              'Please arrive by 3:00 PM to be seated before the ceremony begins at 3:30 PM.',
            open: true,
          },
          {
            question: 'Is there a dress code?',
            answer:
              "Dress is dressy casual. We'll be outside so please dress for the weather.",
            open: false,
          },
          {
            question: 'Where do I park?',
            answer:
              'Parking is available in the field adjacent to the driveway. Please follow the signs to the parking area.',
            open: false,
          },
          {
            question: 'Can I bring a plus-one?',
            answer:
              'We have planned seating carefully; please refer to your invitation for plus-one details.',
            open: false,
          },
        ],
      },
      footnote: {
        text: "We're so excited to celebrate with you in Location.",
      },
    };
  
    function mergeDeep(def, sav) {
      if (Array.isArray(def)) {
        return Array.isArray(sav) ? sav.slice() : def.slice();
      }
      if (def !== null && typeof def === 'object') {
        const out = {};
        for (const k of Object.keys(def)) {
          out[k] = mergeDeep(def[k], sav && typeof sav === 'object' ? sav[k] : undefined);
        }
        return out;
      }
      return sav !== undefined ? sav : def;
    }
  
    function mergeSiteContent(saved) {
      return mergeDeep(DEFAULT_SITE_CONTENT, saved && typeof saved === 'object' ? saved : {});
    }
  
    global.DEFAULT_SITE_CONTENT = DEFAULT_SITE_CONTENT;
    global.mergeSiteContent = mergeSiteContent;
  })(typeof window !== 'undefined' ? window : globalThis);