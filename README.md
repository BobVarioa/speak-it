# speak-it

SpeakIt is a project designed to make text to speech for rich text much more accurate to the authorial intent behind it.
For example, take the sentence "John *ran* to the store" which is clearly not equivalent to "John ran to the store."
Nowadays the internet is full of such styled sentences, and people are used to conveying more information through how they format their text.

Currently, most TTS engines try to solve this problem with sentiment analysis and incredibly large datasets, with even the best leading to mixed results. Instead of this, SpeakIt uses NLP techniques to provide that information in a more straightforward way by applying a preprocessing step.

### Examples
 
For some examples, check out the [examples](./examples/) directory.

### Planned Features
- General
	- [ ] Changing voices inside of quotes, using [BBC's Citron](https://github.com/bbc/citron) for quote extraction
	- [ ] Modifing tone based on emojis
	- [ ] SFX and audio effects for emojis when relevant (💥, 📢, etc.)
	- [ ] Analysis of a person's vocabulary to determine their accent 
- Other
	- [ ] CLI 
	- [ ] An interactive way to edit assumptions manually 
